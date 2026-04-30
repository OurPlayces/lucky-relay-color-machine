"""
Layer 2: deterministic 4-input mapping → 8-knob colour profile.

Inputs (all required):
  - audio_features (from extract_features.py): {"overall": {...}, "sections": [...]}
  - title          (string)
  - genre_tags     (list of strings, lowercased)
  - lyrics         (string; "" if unavailable)

Output: a profile dict with 8 knobs and the raw inputs preserved.

The math is deterministic. Same inputs → same output, every time. No
hand overrides; if the rule produces an unexpected colour, the rule is
the source of truth and should be tuned in this file (not patched per-song).
"""

import json
import re
import sys


# ===========================================================================
# Constants / lookup tables
# ===========================================================================

KEY_TO_HUE = {
    "C": 0,   "C#": 30,  "D": 60,   "D#": 90,
    "E": 120, "F": 150,  "F#": 180, "G": 210,
    "G#": 240, "A": 270, "A#": 300, "B": 330,
}

# Genre clusters: each cluster constrains the body palette to a hue/sat/light
# zone and sets the smear-decay tendency.
# `hue_anchor` is where the body wants to live for that genre family.
# `hue_pull_strength` is how hard the genre pulls the key-derived hue toward anchor.
GENRE_CLUSTERS = {
    "muted_warm": {
        "tags": ["indietronica", "trip-hop", "trip hop", "alt-pop", "alt pop",
                 "dream-pop", "dream pop", "bedroom-pop", "bedroom pop",
                 "ambient-pop"],
        "hue_anchor": 25,
        "hue_pull_strength": 0.55,
        "sat_range": (45, 70),
        "light_range": (45, 60),
        "smear_decay_default": 0.93,
    },
    "bruised_alt": {
        "tags": ["indie-rock", "indie rock", "alt-rock", "alt rock",
                 "grunge-pop", "grunge pop", "grunge", "post-punk", "post punk"],
        "hue_anchor": 350,
        "hue_pull_strength": 0.55,
        "sat_range": (60, 80),
        "light_range": (40, 55),
        "smear_decay_default": 0.88,
    },
    "electric": {
        "tags": ["hyperpop", "hyper-pop", "glitch-pop", "glitch pop",
                 "pc-music", "pc music"],
        "hue_anchor": 320,
        "hue_pull_strength": 0.7,
        "sat_range": (80, 95),
        "light_range": (50, 65),
        "smear_decay_default": 0.85,
    },
    "pale_air": {
        "tags": ["ambient", "drone", "shoegaze", "slowcore"],
        "hue_anchor": 200,
        "hue_pull_strength": 0.4,
        "sat_range": (15, 40),
        "light_range": (65, 85),
        "smear_decay_default": 0.96,
    },
    "saturated_bold": {
        "tags": ["hip-hop", "hip hop", "rap", "r&b", "rnb"],
        "hue_anchor": 280,
        "hue_pull_strength": 0.5,
        "sat_range": (70, 90),
        "light_range": (35, 55),
        "smear_decay_default": 0.87,
    },
    "earthy": {
        "tags": ["folk", "acoustic", "americana", "country"],
        "hue_anchor": 35,
        "hue_pull_strength": 0.45,
        "sat_range": (35, 55),
        "light_range": (40, 55),
        "smear_decay_default": 0.93,
    },
}

DEFAULT_CLUSTER = {
    "hue_anchor": 0,
    "hue_pull_strength": 0.0,
    "sat_range": (50, 75),
    "light_range": (40, 60),
    "smear_decay_default": 0.90,
}

# Keyword banks (title + lyrics scanned together, lowercased word match).
WARM_WORDS = {"shiny", "kindness", "sweet", "love", "loves", "loving", "gold",
              "golden", "warm", "hot", "sun", "sunny", "rose", "roses", "kiss",
              "honey", "amber", "summer", "smile", "soft", "shine"}
COOL_WORDS = {"blue", "cold", "cool", "rain", "rainy", "alone", "lonely",
              "ice", "icy", "deep", "sad", "ghost", "snow", "winter",
              "frozen", "moon", "midnight", "shadow"}
SHARP_WORDS = {"teeth", "tooth", "bite", "biting", "brutal", "knife", "knives",
               "rage", "wreck", "wrecked", "sharp", "fang", "fangs", "blood",
               "wound", "wounded", "bruise", "bruised", "scar", "scars",
               "docket", "court", "cut", "burn", "burned", "burning", "violent",
               "fight", "fighting", "kill", "killed"}
# Dissociative words drop saturation (drained / unmoored) but do NOT pull hue —
# direction is meaningless for "lost / fall apart / is it real".
DISSOCIATIVE_WORDS = {"lost", "lose", "losing", "real", "feel", "feels", "fall",
                      "falling", "apart", "split", "splitting", "gone",
                      "dream", "dreaming", "haze", "hazy", "blur", "blurred"}

# Targets the keyword scan pulls hue toward when the corresponding category dominates.
WARM_HUE_TARGET = 25     # peach
COOL_HUE_TARGET = 220    # sky-blue
SHARP_HUE_TARGET = 340   # hot magenta

# Bridge palette derivation: shifts applied to body primary when the per-section
# analysis flags a real harmonic departure.
BRIDGE_SHIFTS = {
    "mode_flip_to_minor":   {"d_hue": -100, "d_sat": -15, "d_light": -5},
    "iv_chord_shift":       {"d_hue":  -60, "d_sat": -20, "d_light": +10},
    "v_chord_shift":        {"d_hue":  -45, "d_sat": -15, "d_light":  +5},
    "relative_minor_shift": {"d_hue":  -90, "d_sat": -10, "d_light": -10},
    "rms_drop_only":        {"d_hue":  -40, "d_sat": -15, "d_light":  +0},
}


# ===========================================================================
# Helpers
# ===========================================================================

def lerp(a, b, t):
    return a + (b - a) * t

def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def hue_blend(h1, h2, weight):
    """Blend two hues along the shortest arc on the circle. weight ∈ [0,1]."""
    diff = ((h2 - h1 + 540) % 360) - 180
    return (h1 + diff * weight) % 360

def words_in(text, bank):
    if not text:
        return 0
    tokens = re.findall(r"[a-z']+", text.lower())
    return sum(1 for t in tokens if t in bank)

def pick_cluster(genre_tags):
    if not genre_tags:
        return DEFAULT_CLUSTER, "default"
    tags_lower = [t.lower().strip() for t in genre_tags]
    # Score each cluster by how many of its tags appear in the input tags.
    best, best_score = None, 0
    for name, cluster in GENRE_CLUSTERS.items():
        score = sum(1 for t in cluster["tags"] if t in tags_lower)
        if score > best_score:
            best, best_score = name, score
    if best is None:
        return DEFAULT_CLUSTER, "default"
    return GENRE_CLUSTERS[best], best


# ===========================================================================
# Knob derivations
# ===========================================================================

def derive_pulse_rate_hz(features_overall):
    bpm = features_overall["tempo_bpm"]
    return round(bpm / 120 if bpm > 140 else bpm / 60, 3)


def derive_brightness_curve(features_overall):
    e = features_overall["energy_proxy_0_1"]
    if e < 0.33:
        return "soft"
    if e < 0.66:
        return "linear"
    return "explosive"


def derive_palette_drift_range(features_overall):
    dr = features_overall["dynamic_range_db"]
    onset = features_overall["onset_density_per_sec"]
    dr_norm = clamp((dr - 20) / 40, 0, 1)
    onset_norm = clamp(onset / 6, 0, 1)
    return round(lerp(10, 60, dr_norm * 0.6 + onset_norm * 0.4), 1)


def derive_motion_smear_decay(features_overall, cluster):
    base = cluster["smear_decay_default"]
    e = features_overall["energy_proxy_0_1"]
    return round(clamp(base + (0.5 - e) * 0.05, 0.82, 0.97), 3)


def derive_base_palette(features_overall, title, genre_tags, lyrics):
    """
    Hue derivation:
      1) start from key→hue
      2) blend toward genre cluster's hue_anchor
      3) keyword scan blends toward warm/cool/sharp targets
    Saturation: cluster sat_range, modulated by valence + sharp keyword weight.
    Lightness: cluster light_range, modulated by energy + valence.
    """
    cluster, cluster_name = pick_cluster(genre_tags)

    hue = KEY_TO_HUE[features_overall["key"]]
    hue = hue_blend(hue, cluster["hue_anchor"], cluster["hue_pull_strength"])

    text = (title or "") + " " + (lyrics or "")
    warm = words_in(text, WARM_WORDS)
    cool = words_in(text, COOL_WORDS)
    sharp = words_in(text, SHARP_WORDS)
    dissociative = words_in(text, DISSOCIATIVE_WORDS)

    # Dominant-of-warm-cool rule: opposing words shouldn't pull simultaneously
    # (that produces a meaningless hue in the middle of the wheel). Net only.
    net = warm - cool
    if net > 0:
        hue = hue_blend(hue, WARM_HUE_TARGET, clamp(net * 0.08, 0, 0.5))
    elif net < 0:
        hue = hue_blend(hue, COOL_HUE_TARGET, clamp(-net * 0.08, 0, 0.5))
    if sharp:
        hue = hue_blend(hue, SHARP_HUE_TARGET, clamp(sharp * 0.05, 0, 0.3))

    valence = features_overall["valence_proxy_0_1"]
    energy = features_overall["energy_proxy_0_1"]

    sat_lo, sat_hi = cluster["sat_range"]
    sat = lerp(sat_lo, sat_hi, valence) + min(sharp, 6) * 1.5
    # Dissociative words drain saturation: the song's affect is unmoored.
    sat -= min(dissociative, 8) * 1.5
    sat = clamp(sat, 15, 95)

    light_lo, light_hi = cluster["light_range"]
    light = lerp(light_lo, light_hi, energy * 0.6 + valence * 0.4)
    # Dissociation also lifts lightness slightly (the "pale" feel).
    light += min(dissociative, 6) * 0.8
    light = clamp(light, 18, 88)

    return {
        "hue": int(round(hue)),
        "sat": int(round(sat)),
        "light": int(round(light)),
    }, cluster_name, {"warm": warm, "cool": cool, "sharp": sharp, "dissociative": dissociative}


def derive_accent_palette(base, sharp_count):
    """Accent is a sharper, lifted version of base, pulled toward magenta on sharp keywords."""
    target_hue = 330 if sharp_count == 0 else SHARP_HUE_TARGET
    hue = hue_blend(base["hue"], target_hue, 0.7)
    sat = clamp(base["sat"] + 25, 70, 95)
    light = clamp(base["light"] + 12, 45, 75)
    return {"hue": int(round(hue)), "sat": int(round(sat)), "light": int(round(light))}


def derive_panic_palette(base, accent):
    """Panic = accent intensified."""
    hue = hue_blend(accent["hue"], 0, 0.15)  # nudge slightly toward red
    sat = clamp(accent["sat"] + 5, 80, 99)
    light = clamp(accent["light"] - 5, 40, 70)
    return {"hue": int(round(hue)), "sat": int(round(sat)), "light": int(round(light))}


def derive_missed_word_scar(base):
    """Scar lives in the body's tonal family, dark + slightly desaturated."""
    return {
        "hue": int(round(base["hue"])),
        "sat": clamp(base["sat"] - 10, 30, 80),
        "light": 14,
    }


def classify_section_shift(section, overall_key, overall_mode, song_mean_rms):
    """Return None if the section isn't a bridge candidate, else a label."""
    if section["duration_sec"] < 10:
        return None
    if section["mode"] == "minor" and overall_mode == "major":
        return "mode_flip_to_minor"
    if section["mode"] == "major" and overall_mode == "minor":
        return "mode_flip_to_minor"  # reuse shift; same idea
    if section["key"] != overall_key:
        # Approximate IV / V detection via semitone distance from tonic.
        tonic_idx = list(KEY_TO_HUE.keys()).index(overall_key)
        sect_idx = list(KEY_TO_HUE.keys()).index(section["key"])
        dist = (sect_idx - tonic_idx) % 12
        if dist == 5:
            return "iv_chord_shift"
        if dist == 7:
            return "v_chord_shift"
        if dist == 9:
            return "relative_minor_shift"
    if song_mean_rms and section["rms"] < song_mean_rms * 0.85:
        return "rms_drop_only"
    return None


def derive_bridge_palette(base, sections, overall_key, overall_mode, song_mean_rms):
    """Pick the longest bridge-candidate section and apply its tonal shift."""
    candidates = []
    for s in sections:
        label = classify_section_shift(s, overall_key, overall_mode, song_mean_rms)
        if label:
            candidates.append((s["duration_sec"], s, label))
    if not candidates:
        return None, None
    candidates.sort(reverse=True)  # longest first
    _, section, label = candidates[0]
    shift = BRIDGE_SHIFTS[label]
    hue = (base["hue"] + shift["d_hue"]) % 360
    sat = clamp(base["sat"] + shift["d_sat"], 25, 90)
    light = clamp(base["light"] + shift["d_light"], 30, 80)
    return (
        {"hue": int(round(hue)), "sat": int(round(sat)), "light": int(round(light))},
        {"label": label, "section": section},
    )


# ===========================================================================
# Orchestrator
# ===========================================================================

def derive_profile(features, title, artist, genre_tags, lyrics, reader=None):
    overall = features["overall"]
    sections = features.get("sections", [])

    base, cluster_name, kw_counts = derive_base_palette(overall, title, genre_tags, lyrics)
    accent = derive_accent_palette(base, kw_counts["sharp"])
    panic = derive_panic_palette(base, accent)
    scar = derive_missed_word_scar(base)
    cluster = GENRE_CLUSTERS.get(cluster_name, DEFAULT_CLUSTER)
    bridge, bridge_meta = derive_bridge_palette(
        base, sections, overall["key"], overall["mode"], overall.get("song_mean_rms")
    )

    return {
        "reader": reader,
        "song_title": title,
        "artist": artist,
        "genre_tags": genre_tags,
        "song_features": {
            "bpm": overall["tempo_bpm"],
            "key": overall["key"],
            "mode": overall["mode"],
            "energy": overall["energy_proxy_0_1"],
            "valence": overall["valence_proxy_0_1"],
            "duration_sec": overall["duration_sec"],
        },
        "derivation": {
            "genre_cluster": cluster_name,
            "keyword_counts": kw_counts,
            "bridge_meta": bridge_meta,
        },
        "knobs": {
            "base_palette": {"primary": base, "accent": accent},
            "palette_drift_range": derive_palette_drift_range(overall),
            "brightness_curve": derive_brightness_curve(overall),
            "pulse_rate_hz": derive_pulse_rate_hz(overall),
            "motion_smear_decay": derive_motion_smear_decay(overall, cluster),
            "panic_palette": panic,
            "missed_word_scar": scar,
            "bridge_palette": bridge,
            "bridge_trigger": "sustained-quiet" if bridge else None,
        },
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: derive_profile.py <input.json>", file=sys.stderr)
        print("  input.json shape:", file=sys.stderr)
        print("  {features:{...}, title:..., artist:..., genre_tags:[...], lyrics:..., reader:...}",
              file=sys.stderr)
        sys.exit(1)
    with open(sys.argv[1]) as f:
        inp = json.load(f)
    profile = derive_profile(
        features=inp["features"],
        title=inp.get("title", ""),
        artist=inp.get("artist", ""),
        genre_tags=inp.get("genre_tags", []),
        lyrics=inp.get("lyrics", ""),
        reader=inp.get("reader"),
    )
    print(json.dumps(profile, indent=2))
