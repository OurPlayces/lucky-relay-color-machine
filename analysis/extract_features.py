"""
Layer 1: pure measurement.

Reads an MP3, returns an objective audio-features dict. Now includes per-section
analysis so downstream mapping can detect bridges (key/mode/RMS shifts).
"""

import json
import sys

import librosa
import numpy as np


PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
                          2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
                          2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def detect_key(chroma_mean):
    major_corr = [np.corrcoef(chroma_mean, np.roll(MAJOR_PROFILE, s))[0, 1] for s in range(12)]
    minor_corr = [np.corrcoef(chroma_mean, np.roll(MINOR_PROFILE, s))[0, 1] for s in range(12)]
    bm, bn = int(np.argmax(major_corr)), int(np.argmax(minor_corr))
    if major_corr[bm] >= minor_corr[bn]:
        return PITCH_CLASSES[bm], "major", float(major_corr[bm])
    return PITCH_CLASSES[bn], "minor", float(minor_corr[bn])


def extract_overall(y, sr):
    duration = float(librosa.get_duration(y=y, sr=sr))

    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    tempo = float(np.atleast_1d(tempo)[0])

    onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time")
    onset_density = float(len(onsets) / duration) if duration > 0 else 0.0

    rms = librosa.feature.rms(y=y)[0]
    rms_db = librosa.amplitude_to_db(rms, ref=np.max)
    mean_loudness_db = float(np.mean(rms_db))
    dynamic_range_db = float(np.max(rms_db) - np.min(rms_db))

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, tuning=0.0)
    chroma_mean = chroma.mean(axis=1)
    key, mode, key_conf = detect_key(chroma_mean)

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    mean_centroid_hz = float(np.mean(centroid))
    timbre_brightness = float(min(1.0, mean_centroid_hz / 5500.0))

    mode_score = 0.65 if mode == "major" else 0.35
    tempo_score = max(0.0, min(1.0, (tempo - 60) / 120))
    valence_proxy = float(np.clip(mode_score * 0.5 + timbre_brightness * 0.3 + tempo_score * 0.2, 0, 1))

    loudness_score = max(0.0, min(1.0, (mean_loudness_db + 30) / 30))
    onset_score = max(0.0, min(1.0, onset_density / 6.0))
    energy_proxy = float(np.clip(tempo_score * 0.4 + loudness_score * 0.3 + onset_score * 0.3, 0, 1))

    return {
        "duration_sec": round(duration, 2),
        "tempo_bpm": round(tempo, 1),
        "onset_density_per_sec": round(onset_density, 2),
        "mean_loudness_db": round(mean_loudness_db, 2),
        "dynamic_range_db": round(dynamic_range_db, 2),
        "key": key,
        "mode": mode,
        "key_confidence": round(key_conf, 3),
        "timbre_brightness_0_1": round(timbre_brightness, 3),
        "valence_proxy_0_1": round(valence_proxy, 3),
        "energy_proxy_0_1": round(energy_proxy, 3),
    }, chroma, rms


def extract_sections(y, sr, k=10, min_seg_sec=2.0):
    """Per-section key/mode/RMS/brightness."""
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, tuning=0.0)
    boundaries = librosa.segment.agglomerative(chroma, k=k)
    times = librosa.frames_to_time(boundaries, sr=sr).tolist()
    duration = float(librosa.get_duration(y=y, sr=sr))
    times = sorted(set([0.0] + [round(t, 2) for t in times] + [duration]))

    sections = []
    for i in range(len(times) - 1):
        t0, t1 = times[i], times[i + 1]
        if t1 - t0 < min_seg_sec:
            continue
        s0, s1 = int(t0 * sr), int(t1 * sr)
        seg = y[s0:s1]
        if len(seg) < sr // 2:
            continue
        seg_chroma = librosa.feature.chroma_cqt(y=seg, sr=sr, tuning=0.0).mean(axis=1)
        k_, m_, conf_ = detect_key(seg_chroma)
        rms = float(np.mean(librosa.feature.rms(y=seg)[0]))
        centroid = float(np.mean(librosa.feature.spectral_centroid(y=seg, sr=sr)[0]))
        sections.append({
            "start_sec": round(t0, 2),
            "end_sec": round(t1, 2),
            "duration_sec": round(t1 - t0, 2),
            "key": k_,
            "mode": m_,
            "key_confidence": round(conf_, 3),
            "rms": round(rms, 4),
            "spectral_centroid_hz": round(centroid, 1),
        })
    return sections


def extract(path):
    y, sr = librosa.load(path, sr=22050, mono=True)
    overall, _, rms = extract_overall(y, sr)
    sections = extract_sections(y, sr)
    overall["song_mean_rms"] = round(float(np.mean(rms)), 4)
    return {"overall": overall, "sections": sections}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: extract_features.py <mp3>", file=sys.stderr)
        sys.exit(1)
    print(json.dumps(extract(sys.argv[1]), indent=2))
