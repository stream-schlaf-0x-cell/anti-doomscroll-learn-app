import { it } from 'node:test';
import assert from 'node:assert/strict';
import { refreshLocalEdition } from '../src/core/context/localFeedRefresh';

it('commits the local edition while weather is still pending', {timeout:1000}, async()=>{
  let resolveWeather!: (value:null)=>void;
  const weather = new Promise<null>(resolve=>{resolveWeather=resolve;});
  let feedCommitted=false;
  let weatherCommitted=false;
  await refreshLocalEdition({
    loadDaily:async()=>[],loadDiscovery:async()=>[],
    onFeed:()=>{feedCommitted=true;},
    loadWeather:()=>weather,onWeather:()=>{weatherCommitted=true;}
  });
  assert.equal(feedCommitted,true);
  assert.equal(weatherCommitted,false,'The local feed must be usable before a weather response');
  resolveWeather(null);
  await weather;
  await Promise.resolve();
  assert.equal(weatherCommitted,true);
});

it('discards stale local data and weather completions',async()=>{
  let current=true;
  let resolveWeather!: (value:null)=>void;
  const weather=new Promise<null>(resolve=>{resolveWeather=resolve;});
  let weatherCommits=0;
  await refreshLocalEdition({loadDaily:async()=>[],loadDiscovery:async()=>[],onFeed:()=>{},loadWeather:()=>weather,onWeather:()=>{weatherCommits++;},isCurrent:()=>current});
  current=false;
  resolveWeather(null);
  await weather;
  await Promise.resolve();
  assert.equal(weatherCommits,0);
  let feedCommits=0;
  await refreshLocalEdition({loadDaily:async()=>[],loadDiscovery:async()=>[],onFeed:()=>{feedCommits++;},isCurrent:()=>false});
  assert.equal(feedCommits,0);
});

it('keeps local reading ready when the weather service fails',async()=>{
  let weatherValue:unknown='pending';
  let committed=false;
  await refreshLocalEdition({loadDaily:async()=>[],loadDiscovery:async()=>[],onFeed:()=>{committed=true;},loadWeather:async()=>{throw new Error('offline');},onWeather:value=>{weatherValue=value;}});
  await Promise.resolve();
  assert.equal(committed,true);
  assert.equal(weatherValue,null);
});
