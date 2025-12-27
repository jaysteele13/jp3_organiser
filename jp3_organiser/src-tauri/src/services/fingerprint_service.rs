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

use crate::models::{MetadataStatus, ProcessedAudioFingerprint };

pub fn lookup_acoustid(fingerprint_result: &ProcessedAudioFingerprint) -> anyhow::Result<serde_json::Value> {
    log::info!("lookup_acoustid called with fingerprint_id: {} (length: {}), duration: {}s",
        &fingerprint_result.fingerprint_id[..std::cmp::min(20, fingerprint_result.fingerprint_id.len())],
        fingerprint_result.fingerprint_id.len(),
        fingerprint_result.duration_seconds
    );

    let client = reqwest::blocking::Client::new();

    log::info!("Sending GET request to https://api.acoustid.org/v2/lookup");

    let res = client
        .get("https://api.acoustid.org/v2/lookup")
        .query(&[
            ("client", "YOUR_API_KEY"),
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
    let file = File::open(path)?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let hint = Hint::new();
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())?;

    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| anyhow::anyhow!("No default audio track"))?;

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

    let mut chroma = Chromaprint::new();
    if !chroma.start(sample_rate as i32, channels as i32) {
        return Err(anyhow::anyhow!("Failed to start chromaprint"));
    }

    let mut total_samples: u64 = 0;

    while let Ok(packet) = format.next_packet() {
        let decoded = decoder.decode(&packet)?;

        match decoded {
            AudioBufferRef::F32(buf) => {
                total_samples += buf.frames() as u64;
                for sample in buf.chan(0) {
                    let sample_u8 = (*sample * 127.0 + 128.0) as u8;
                    chroma.feed(&[sample_u8]);
                }
            }
            AudioBufferRef::U16(buf) => {
                total_samples += buf.frames() as u64;
                for sample in buf.chan(0) {
                    let sample_u8 = (*sample >> 8) as u8;
                    chroma.feed(&[sample_u8]);
                }
            }
            _ => {}
        }
    }

    chroma.finish();

    let duration_seconds = total_samples / sample_rate as u64;

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
