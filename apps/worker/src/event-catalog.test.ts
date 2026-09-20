import assert from "node:assert/strict";
import test from "node:test";
import { allEventTypes, eventCatalog, eventDefinition } from "./event-catalog";
import { queueForEvent } from "./dispatch";

test("every catalog event has a classification, queue, and purpose", () => {
  assert.ok(allEventTypes.length >= 49);
  for (const type of allEventTypes) {
    const definition = eventCatalog[type];
    assert.ok(["actionable", "informational", "deprecated"].includes(definition.classification));
    assert.ok(definition.queue.length > 0);
    assert.ok(definition.purpose.length > 0);
    assert.equal(queueForEvent(type), definition.queue);
  }
});

test("unknown events fail closed", () => {
  assert.equal(eventDefinition("unknown.event"), null);
  assert.equal(queueForEvent("unknown.event"), null);
});
