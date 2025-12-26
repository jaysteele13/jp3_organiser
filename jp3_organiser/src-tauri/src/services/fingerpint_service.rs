//! Use Chromaprint/AcousticID for fingerprinting (future)
use chromaprint::{Chromaprint, Algorithm};
use symphonia::core::{
    audio::AudioBufferRef,
    codecs::DecoderOptions,
    formats::FormatOptions,
    io::MediaSourceStream,
    meta::MetadataOptions,
    probe::Hint,
};
use std::fs::File;
use std::path::Path;

use crate::models::{AudioFingerprintResult, MetadataStatus, ProcessedAudioFingerprint };

fn lookup_acoustid(fingerprint_result: &ProcessedAudioFingerprint) -> anyhow::Result<()> {
    let client = reqwest::blocking::Client::new();

    let res = client
        .get("https://api.acoustid.org/v2/lookup")
        .query(&[
            ("client", env.local.get("ACOUSTIC_ID_API_KEY").unwrap()),
            ("meta", "recordings"),
            ("duration", &fingerprint_result.duration_seconds.to_string()),
            ("fingerprint", &fingerprint_result.fingerprint_id),
        ])
        .send()?
        .text()?;

    println!("Response: {}", res);
    Ok(())
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

    let mut chroma = Chromaprint::new(Algorithm::Test2);
    chroma.start(sample_rate as i32, channels as i32)?;

    let mut total_samples: u64 = 0;

    while let Ok(packet) = format.next_packet() {
        let decoded = decoder.decode(&packet)?;

        match decoded {
            AudioBufferRef::F32(buf) => {
                total_samples += buf.frames() as u64;
                chroma.feed(buf.chan(0));
            }
            AudioBufferRef::I16(buf) => {
                total_samples += buf.frames() as u64;
                chroma.feed(buf.chan(0));
            }
            _ => {}
        }
    }

    chroma.finish();

    let duration_seconds = total_samples / sample_rate as u64;

    Ok((chroma.get_fingerprint(), duration_seconds as u32))
}


pub fn process_audio_fingerprint<P: AsRef<Path>>(
    path: P,
    tracking_id: String,
) -> ProcessedAudioFingerprint {
    match inner_process_audio_fingerprint(path) {
        Ok((fingerprint, duration)) => ProcessedAudioFingerprint {
            fingerprint_id: fingerprint,
            tracking_id,
            fingerprint_status: MetadataStatus::Success,
            error_message: None,
        },
        Err(err) => ProcessedAudioFingerprint {
            fingerprint_id: String::new(),
            tracking_id,
            fingerprint_status: MetadataStatus::Failed,
            error_message: Some(err.to_string()),
        },
    }
}
