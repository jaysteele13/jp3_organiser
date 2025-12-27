//! Use Chromaprint/AcousticID for fingerprinting (future)
use chromaprint::Chromaprint;
use symphonia::core::{
    audio::{AudioBufferRef, Signal},
    codecs::DecoderOptions,
    formats::FormatOptions,
    io::MediaSourceStream,
    meta::MetadataOptions,
    probe::Hint,
};
use std::fs::File;
use std::path::Path;
use std::env::var;

use crate::models::{MetadataStatus, ProcessedAudioFingerprint };

pub fn lookup_acoustid(fingerprint_result: &ProcessedAudioFingerprint) -> anyhow::Result<serde_json::Value> {
    log::info!("lookup_acoustid called with fingerprint_id: {} (length: {}), duration: {}s",
        &fingerprint_result.fingerprint_id[..std::cmp::min(20, fingerprint_result.fingerprint_id.len())],
        fingerprint_result.fingerprint_id.len(),
        fingerprint_result.duration_seconds
    );

    let client = reqwest::blocking::Client::new();

    let api_key = var("ACOUSTIC_ID_API_KEY").map_err(|e| {
        log::error!("ACOUSTIC_ID_API_KEY environment variable not set: {}", e);
        e
    })?;

    

    log::info!("Sending GET request to https://api.acoustid.org/v2/lookup");

    let res = client
        .get("https://api.acoustid.org/v2/lookup")
        .query(&[
            ("client", api_key.as_str()),
            ("format", "json"),
            ("meta", "recordings"),
            ("duration", &fingerprint_result.duration_seconds.to_string()),
            ("fingerprint", &fingerprint_result.fingerprint_id),
        ])
        .send()
        .map_err(|e| {
            log::error!("Failed to send request to AcousticID API: {}", e);
            e
        })?;

    log::info!("Received response from AcousticID API");

    let response_text = res.text().map_err(|e| {
        log::error!("Failed to read response body: {}", e);
        e
    })?;

    log::info!("Response body (first 200 chars): {}",
        &response_text[..std::cmp::min(200, response_text.len())]
    );

    let json: serde_json::Value = serde_json::from_str(&response_text).map_err(|e| {
        log::error!("Failed to parse JSON response: {}", e);
        log::error!("Response was: {}", response_text);
        e
    })?;

    log::info!("Successfully parsed AcousticID response");
    Ok(json)
}


fn inner_process_audio_fingerprint<P: AsRef<Path>>(
    path: P,
) -> anyhow::Result<(String, u32)> {
    log::info!("Opening audio file: {:?}", path.as_ref());

    let file = File::open(path)?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    hint.with_extension("wav");

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())?;

    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| anyhow::anyhow!("No default audio track"))?;

    log::info!("Track codec: {:?}", track.codec_params.codec);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())?;

    let sample_rate = track
        .codec_params
        .sample_rate
        .ok_or_else(|| anyhow::anyhow!("Missing sample rate"))?;

    let channels = track
        .codec_params
        .channels
        .ok_or_else(|| anyhow::anyhow!("Missing channel count"))?
        .count();

    log::info!("Audio info - Sample rate: {} Hz, Channels: {}", sample_rate, channels);

    let mut chroma = Chromaprint::new();
    if !chroma.start(sample_rate as i32, channels as i32) {
        return Err(anyhow::anyhow!("Failed to start chromaprint"));
    }

    log::info!("Chromaprint started successfully");

    let mut total_samples: u64 = 0;
    let mut packet_count: u64 = 0;

    loop {
        let packet = match format.next_packet() {
            Ok(pkt) => pkt,
            Err(e) => {
                log::debug!("End of stream or error reading packet: {}", e);
                break;
            }
        };

        packet_count += 1;

        let decoded = match decoder.decode(&packet) {
            Ok(buf) => buf,
            Err(e) => {
                log::warn!("Failed to decode packet {}: {}", packet_count, e);
                continue;
            }
        };

        log::debug!("Decoded packet {} - buffer type: {:?}", packet_count, std::mem::discriminant(&decoded));

        match decoded {
            AudioBufferRef::F32(buf) => {
                let frames = buf.frames();
                total_samples += frames as u64;
                log::debug!("F32 buffer - frames: {}", frames);

                let mut interleaved = Vec::with_capacity(frames * channels);
                for frame in 0..frames {
                    for chan in 0..channels {
                        let sample = buf.chan(chan)[frame];
                        let sample_u8 = (sample * 127.0 + 128.0) as u8;
                        interleaved.push(sample_u8);
                    }
                }
                chroma.feed(&interleaved);
            }
            AudioBufferRef::U16(buf) => {
                let frames = buf.frames();
                total_samples += frames as u64;
                log::debug!("U16 buffer - frames: {}", frames);

                let mut interleaved = Vec::with_capacity(frames * channels);
                for frame in 0..frames {
                    for chan in 0..channels {
                        let sample = buf.chan(chan)[frame];
                        let sample_u8 = (sample >> 8) as u8;
                        interleaved.push(sample_u8);
                    }
                }
                chroma.feed(&interleaved);
            }
            AudioBufferRef::S16(buf) => {
                let frames = buf.frames();
                total_samples += frames as u64;
                log::debug!("S16 buffer - frames: {}", frames);

                let mut interleaved = Vec::with_capacity(frames * channels);
                for frame in 0..frames {
                    for chan in 0..channels {
                        let sample = buf.chan(chan)[frame];
                        let sample_u8 = ((sample >> 8) + 128) as u8;
                        interleaved.push(sample_u8);
                    }
                }
                chroma.feed(&interleaved);
            }
            AudioBufferRef::S32(buf) => {
                let frames = buf.frames();
                total_samples += frames as u64;
                log::debug!("S32 buffer - frames: {}", frames);

                let mut interleaved = Vec::with_capacity(frames * channels);
                for frame in 0..frames {
                    for chan in 0..channels {
                        let sample = buf.chan(chan)[frame];
                        let sample_u8 = ((sample >> 24) + 128) as u8;
                        interleaved.push(sample_u8);
                    }
                }
                chroma.feed(&interleaved);
            }
            _ => {
                log::warn!("Unsupported audio buffer type: {:?}", std::mem::discriminant(&decoded));
            }
        }

        if packet_count % 100 == 0 {
            log::debug!("Processed {} packets, total samples: {}", packet_count, total_samples);
        }
    }

    chroma.finish();

    let duration_seconds = total_samples / sample_rate as u64;

    log::info!("Processing complete - packets: {}, samples: {}, duration: {}s",
        packet_count, total_samples, duration_seconds
    );

    Ok((chroma.fingerprint().unwrap_or_default(), duration_seconds as u32))
}


pub fn process_audio_fingerprint<P: AsRef<Path>>(
    path: P,
    tracking_id: String,
) -> ProcessedAudioFingerprint {
    log::info!("process_audio_fingerprint called for path: {:?}, tracking_id: {}", path.as_ref(), tracking_id);

    match inner_process_audio_fingerprint(path) {
        Ok((fingerprint, duration)) => {
            log::info!("Fingerprint processed successfully - duration: {}s, fingerprint length: {}",
                duration,
                fingerprint.len()
            );
            ProcessedAudioFingerprint {
                fingerprint_id: fingerprint,
                tracking_id,
                fingerprint_status: MetadataStatus::Success,
                error_message: None,
                duration_seconds: duration,
            }
        }
        Err(err) => {
            log::error!("Failed to process audio fingerprint: {}", err);
            ProcessedAudioFingerprint {
                fingerprint_id: String::new(),
                tracking_id,
                fingerprint_status: MetadataStatus::Failed,
                error_message: Some(err.to_string()),
                duration_seconds: 0,
            }
        }
    }
}
