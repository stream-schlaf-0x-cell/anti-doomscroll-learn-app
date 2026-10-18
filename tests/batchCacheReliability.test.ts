import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BatchEditionEnricher } from '../src/core/enrichment/batchEnricher';
import { EnrichmentCache } from '../src/core/enrichment/cache';
import { EnrichmentUsageLedger } from '../src/core/enrichment/ledger';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';

const credentials = { provider: 'gemini' as const, apiKey: 'test-dummy-key', model: 'gemini-2.5-flash' };
const item = { ...INITIAL_FIXTURES[0], articleBody: 'Original source body about philosophy and evidence. '.repeat(30) };

describe('Batch curation cache and truthful execution report', () => {
  it('reuses successful curation and invalidates it when source content changes', async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify([{id:item.id,curationScore:9,feedText:'An evidence based reflection.',keyInsight:'A source backed insight.',primaryTopic:'philosophy_ethics',topics:['philosophy_ethics'],didacticTransfer:'Discuss the evidence.'}]) }] } }], usageMetadata:{promptTokenCount:100,candidatesTokenCount:100} }), {status:200});
    };
    try {
      const enricher = new BatchEditionEnricher(new EnrichmentUsageLedger('',false), async()=>credentials, new EnrichmentCache('',false));
      const first = await enricher.gatekeepAndEnrichBatch([item]);
      const second = await enricher.gatekeepAndEnrichBatch([item]);
      assert.equal(first[0].feedText, 'An evidence based reflection.');
      assert.equal(second[0].feedText, first[0].feedText);
      assert.equal(calls, 1, 'Identical curation must not spend twice');
      assert.deepEqual(enricher.getLastBatchReport(), {candidateCount:1,approvedCount:1,rejectedCount:0,usedAI:false,usedFallback:false,cacheHits:1});
      await enricher.gatekeepAndEnrichBatch([{...item,articleBody:item.articleBody+' Changed evidence.'}]);
      assert.equal(calls, 2, 'A changed source body must be re-evaluated');
      await enricher.gatekeepAndEnrichBatch([item], {...credentials,model:'gemini-2.5-pro'});
      assert.equal(calls, 3, 'A different model has a separate cache entry');
    } finally { globalThis.fetch=originalFetch; }
  });

  it('shares an in-flight curation and bounds metadata as well as excerpts', async () => {
    const originalFetch = globalThis.fetch;
    let calls=0;
    globalThis.fetch=async (_url,init)=>{
      calls++;
      const body=JSON.parse(String(init?.body));
      const prompt=body.contents[0].parts[0].text;
      const payload=JSON.parse(prompt.slice(prompt.indexOf('\n')+1));
      assert.ok(payload[0].excerpt.length<=280);
      assert.ok(payload[0].title.length<=240);
      assert.ok(payload[0].subtitle.length<=280);
      assert.ok(payload[0].publisher.length<=120);
      await new Promise(resolve=>setTimeout(resolve,10));
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify([{id:item.id,curationScore:8,feedText:'A careful synthesis.',primaryTopic:'philosophy_ethics',topics:['philosophy_ethics']}])}]}}]}),{status:200});
    };
    try {
      const enricher=new BatchEditionEnricher(new EnrichmentUsageLedger('',false),async()=>credentials,new EnrichmentCache('',false));
      const large={...item,title:'T'.repeat(2000),subtitle:'S'.repeat(20000),sourceReferences:[{...item.sourceReferences[0],publisher:'P'.repeat(2000)}]};
      const [a,b]=await Promise.all([enricher.gatekeepAndEnrichBatch([large]),enricher.gatekeepAndEnrichBatch([large])]);
      assert.equal(a[0].feedText,'A careful synthesis.');
      assert.equal(b[0].feedText,'A careful synthesis.');
      assert.equal(calls,1);
    } finally { globalThis.fetch=originalFetch; }
  });

  it('does not cache failed AI attempts or falsely report offline heuristics as AI', async () => {
    const originalFetch=globalThis.fetch;
    let calls=0;
    globalThis.fetch=async()=>{calls++;throw new Error('Network unavailable');};
    try {
      const enricher=new BatchEditionEnricher(new EnrichmentUsageLedger('',false),async()=>credentials,new EnrichmentCache('',false));
      await enricher.gatekeepAndEnrichBatch([item]);
      await enricher.gatekeepAndEnrichBatch([item]);
      assert.equal(calls,2,'A transient network failure must remain retryable');
      assert.equal(enricher.getLastBatchReport().usedFallback,true);
      const offline=new BatchEditionEnricher(new EnrichmentUsageLedger('',false),async()=>({provider:'gemini',apiKey:''}),new EnrichmentCache('',false));
      await offline.gatekeepAndEnrichBatch([item]);
      assert.equal(offline.getLastBatchReport().usedAI,false);
      assert.equal(offline.getLastBatchReport().usedFallback,true);
    } finally {globalThis.fetch=originalFetch;}
  });
});
