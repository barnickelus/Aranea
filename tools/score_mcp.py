#!/usr/bin/env python3
"""MCP server (stdio) that lets an LLM read and edit a Note Catcher score file.

Usage:  python3 score_mcp.py /path/to/score.json
The file is the one "Save score file" writes; load it back with "Load a recording or score".
Standard library only.
"""
import json
import os
import sys
import uuid

PATH = sys.argv[1] if len(sys.argv) > 1 else "score.json"
PMIN, PMAX = 24, 96


def load():
    if not os.path.exists(PATH):
        return {"title": "Untitled", "bpm": 100, "notes": []}
    with open(PATH, encoding="utf-8") as f:
        return json.load(f)


def save(score):
    tmp = PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(score, f, indent=1)
    os.replace(tmp, PATH)


def pick(score, ids):
    return [n for n in score["notes"] if not ids or n["id"] in ids]


def t_get_score(a):
    return load()


def t_add_notes(a):
    s = load()
    made = []
    for n in a["notes"]:
        note = {
            "id": uuid.uuid4().hex[:7],
            "pitch": max(PMIN, min(PMAX, int(round(n["pitch"])))),
            "start": max(0.0, float(n["start"])),
            "dur": max(0.05, float(n["dur"])),
            "vel": max(0.05, min(1.0, float(n.get("vel", 0.8)))),
        }
        s["notes"].append(note)
        made.append(note)
    save(s)
    return {"added": made}


def t_update_note(a):
    s = load()
    for n in s["notes"]:
        if n["id"] == a["id"]:
            for k in ("pitch", "start", "dur", "vel"):
                if k in a:
                    n[k] = int(round(a[k])) if k == "pitch" else float(a[k])
            save(s)
            return {"updated": n}
    raise ValueError("no note with id " + str(a["id"]))


def t_delete_notes(a):
    s = load()
    ids = set(a["ids"])
    before = len(s["notes"])
    s["notes"] = [n for n in s["notes"] if n["id"] not in ids]
    save(s)
    return {"deleted": before - len(s["notes"])}


def t_transpose(a):
    s = load()
    hit = pick(s, set(a.get("ids") or []))
    for n in hit:
        n["pitch"] = max(PMIN, min(PMAX, n["pitch"] + int(a["semitones"])))
    save(s)
    return {"changed": len(hit)}


def t_quantize(a):
    s = load()
    q = float(a["grid"])
    if q <= 0:
        raise ValueError("grid must be above 0")
    hit = pick(s, set(a.get("ids") or []))
    for n in hit:
        n["start"] = round(round(n["start"] / q) * q, 3)
        n["dur"] = round(max(q, round(n["dur"] / q) * q), 3)
    save(s)
    return {"changed": len(hit)}


def t_set_tempo(a):
    s = load()
    s["bpm"] = max(30, min(300, int(round(a["bpm"]))))
    save(s)
    return {"bpm": s["bpm"]}


NUM = {"type": "number"}
IDS = {"type": "array", "items": {"type": "string"}, "description": "Note ids; omit for every note"}
TOOLS = {
    "get_score": (t_get_score, "Read the whole score. pitch is a MIDI number (60 = middle C); start and dur are in beats; vel is 0.05-1.", {}, []),
    "add_notes": (t_add_notes, "Add notes.", {"notes": {"type": "array", "items": {"type": "object", "properties": {"pitch": NUM, "start": NUM, "dur": NUM, "vel": NUM}, "required": ["pitch", "start", "dur"]}}}, ["notes"]),
    "update_note": (t_update_note, "Change one note's pitch, start, dur or vel.", {"id": {"type": "string"}, "pitch": NUM, "start": NUM, "dur": NUM, "vel": NUM}, ["id"]),
    "delete_notes": (t_delete_notes, "Delete notes by id.", {"ids": {"type": "array", "items": {"type": "string"}}}, ["ids"]),
    "transpose": (t_transpose, "Move notes up or down by semitones.", {"semitones": NUM, "ids": IDS}, ["semitones"]),
    "quantize": (t_quantize, "Snap note starts and lengths to a grid given in beats (0.25 = sixteenth notes).", {"grid": NUM, "ids": IDS}, ["grid"]),
    "set_tempo": (t_set_tempo, "Set the tempo in beats per minute.", {"bpm": NUM}, ["bpm"]),
}


def handle(msg):
    m, p = msg.get("method"), msg.get("params") or {}
    if m == "initialize":
        return {"protocolVersion": p.get("protocolVersion", "2024-11-05"), "capabilities": {"tools": {}},
                "serverInfo": {"name": "note-catcher-score", "version": "0.1.0"}}
    if m == "ping":
        return {}
    if m == "tools/list":
        return {"tools": [{"name": k, "description": v[1], "inputSchema": {"type": "object", "properties": v[2], "required": v[3]}}
                          for k, v in TOOLS.items()]}
    if m == "tools/call":
        try:
            out = TOOLS[p["name"]][0](p.get("arguments") or {})
            return {"content": [{"type": "text", "text": json.dumps(out)}]}
        except Exception as e:  # reported to the model, not raised
            return {"content": [{"type": "text", "text": "Error: " + str(e)}], "isError": True}
    raise LookupError(m)


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        msg = json.loads(line)
        if "id" not in msg:
            continue
        try:
            reply = {"jsonrpc": "2.0", "id": msg["id"], "result": handle(msg)}
        except LookupError:
            reply = {"jsonrpc": "2.0", "id": msg["id"], "error": {"code": -32601, "message": "Method not found"}}
        sys.stdout.write(json.dumps(reply) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
