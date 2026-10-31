import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitVisualReferences} from '../src/core/inline-visuals.ts';
import {resolveRoleSpec} from '../src/core/settings-resolution.ts';
test('standalone visual references preserve text and ignore inline and fenced examples',()=>{
 assert.deepEqual(splitVisualReferences('Before\n\n[visual](lh-artifact:job_123)\n\nAfter'),[{text:'Before\n\n'},{jobId:'job_123'},{text:'\nAfter'}]);
 assert.deepEqual(splitVisualReferences('`[visual](lh-artifact:job_123)`'),[{text:'`[visual](lh-artifact:job_123)`'}]);
 assert.deepEqual(splitVisualReferences('```md\n[visual](lh-artifact:job_123)\n```'),[{text:'```md\n[visual](lh-artifact:job_123)\n```'}]);
});
test('visual builder default is independent of cheap',()=>{
 assert.deepEqual(resolveRoleSpec('demoBuilder',null),{provider:'kimi-coding',id:'k3-256k',thinkingLevel:'max'});
});

test('explicit visual model overrides the independent default',()=>{
 assert.deepEqual(resolveRoleSpec('demoBuilder',{version:1,agent:{models:{demoBuilder:{model:{provider:'test',id:'chosen'},thinkingLevel:'high'}}}}),{provider:'test',id:'chosen',thinkingLevel:'high'});
});
