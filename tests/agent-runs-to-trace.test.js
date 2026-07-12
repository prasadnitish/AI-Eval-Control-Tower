import test from "node:test";import assert from "node:assert/strict";import {rowsToTrace} from "../scripts/agent-runs-to-trace.js";
test("reconciles orchestrator rows into an ordered parallel waterfall",()=>{const trace=rowsToTrace("r",[
{span_id:"1",child_agent:"retrieval_agent",status:"ok",latency_ms:100,edge_summary:{next:["itinerary_agent","safety_agent"]},timestamp:"2026-01-01T00:00:00Z",tenant_id:"t",service_id:"s"},
{span_id:"2",child_agent:"itinerary_agent",status:"ok",latency_ms:200,edge_summary:{},timestamp:"2026-01-01T00:00:01Z",tenant_id:"t",service_id:"s"},
{span_id:"3",child_agent:"safety_agent",status:"skipped",latency_ms:10,edge_summary:{},timestamp:"2026-01-01T00:00:01Z",tenant_id:"t",service_id:"s"},
{span_id:"4",child_agent:"packing_agent",status:"ok",latency_ms:50,edge_summary:{},timestamp:"2026-01-01T00:00:02Z",tenant_id:"t",service_id:"s"}
]);assert.equal(trace.spans.length,4);assert.equal(trace.spans[1].start_ms,trace.spans[2].start_ms);assert.ok(trace.spans[3].start_ms>=trace.spans[1].end_ms);assert.equal(trace.spans[2].cost,null);assert.deepEqual(trace.spans[0].detail,{next:["itinerary_agent","safety_agent"]});});
