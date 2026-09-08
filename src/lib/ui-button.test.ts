import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appButtonClass } from "./ui-button";

describe("appButtonClass", () => {
  it("keeps primary and secondary on the same compact scale", () => {
    const primary = appButtonClass("primary");
    const secondary = appButtonClass("secondary");
    for (const token of ["min-h-10", "px-3", "py-1.5", "rounded-full", "w-fit", "text-[11px]"]) {
      assert.ok(primary.includes(token), `primary missing ${token}`);
      assert.ok(secondary.includes(token), `secondary missing ${token}`);
    }
    assert.ok(primary.includes("graphite"));
    assert.ok(secondary.includes("border"));
  });

  it("appends optional className without dropping base scale", () => {
    const cls = appButtonClass("soft", "ml-auto");
    assert.ok(cls.includes("min-h-10"));
    assert.ok(cls.includes("ml-auto"));
  });
});
