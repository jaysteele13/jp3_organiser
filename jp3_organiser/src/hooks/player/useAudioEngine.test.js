// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioEngine } from "./useAudioEngine";

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(async () => new Uint8Array(8)),
}));

let contexts;

class FakeAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.destination = {};
    this.gain = { gain: { value: 1 }, connect: vi.fn() };
    this.sources = [];
    this.decodeAudioData = vi.fn(async () => ({ duration: 100 }));
    this.close = vi.fn(async () => {
      this.state = "closed";
    });
    contexts.push(this);
  }
  createGain() {
    return this.gain;
  }
  createBufferSource() {
    const source = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    this.sources.push(source);
    return source;
  }
}

beforeEach(() => {
  contexts = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const setup = (volume = 1) =>
  renderHook((props) => useAudioEngine(props), { initialProps: { volume } });

describe("useAudioEngine context recreation", () => {
  it("closes the previous context and plays on a new one on a second loadAndPlay", async () => {
    const { result } = setup();

    await act(() => result.current.loadAndPlay("a.mp3"));
    const first = contexts.at(-1);
    await act(() => result.current.loadAndPlay("b.mp3"));
    const second = contexts.at(-1);

    expect(second).not.toBe(first);
    expect(first.close).toHaveBeenCalled();
    expect(second.close).not.toHaveBeenCalled();
    expect(second.sources.at(-1).start).toHaveBeenCalledWith(0, 0);
  });

  it("resumes on a new context from the paused offset without decoding again", async () => {
    const { result } = setup();

    await act(() => result.current.loadAndPlay("a.mp3"));
    const first = contexts.at(-1);
    first.currentTime = 5;
    act(() => result.current.pause());
    await act(() => result.current.resume());
    const second = contexts.at(-1);

    expect(second).not.toBe(first);
    expect(first.close).toHaveBeenCalled();
    expect(second.sources.at(-1).start).toHaveBeenCalledWith(0, 5);
    expect(second.decodeAudioData).not.toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
  });

  it("applies the current volume, not the initial one, to a new gain node", async () => {
    const { result, rerender } = setup(1);

    await act(() => result.current.loadAndPlay("a.mp3"));
    rerender({ volume: 0.3 });
    await act(() => result.current.loadAndPlay("b.mp3"));

    expect(contexts.at(-1).gain.gain.value).toBe(0.3);
  });
});
