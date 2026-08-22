#!/usr/bin/env node
/**
 * Tests for the segmenter, because everything else rests on it.
 *
 * If segmentation joins two unrelated bullets, or separates an instruction from
 * the mod it names, the labelling can be perfectly consistent and the unit
 * still wrong, and nothing downstream would show it. One page parsing nicely
 * proves very little, so the shapes below are drawn from real descriptions:
 * headings, nested lists, tables, both link syntaxes, malformed markup, XML
 * blocks, and bullets with no punctuation at all.
 */

import { segments, excerpt, clean } from './segment.mjs';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok    ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? `: ${detail}` : ''}`); }
};

/* A bullet carrying advice and no full stop must survive as its own segment. */
{
  const d = '[list][*]Load this after ImprovedUI[*]Then install the patch[/list]';
  const s = segments(d);
  check('bullets without punctuation stay separate',
    s.length >= 2 && s.some(x => /Load this after ImprovedUI/.test(x.text))
      && !s.some(x => /ImprovedUI.*Then install/s.test(x.text)),
    JSON.stringify(s.map(x => x.text)));
}

/* A heading applies to what follows, and is not itself a segment. */
{
  const d = '[b]Installation[/b]\n\nCopy the pak to your Mods folder.\n\nPlace it last.';
  const s = segments(d);
  check('a heading labels the segments under it',
    s.every(x => x.heading === 'Installation') && !s.some(x => x.text === 'Installation'),
    JSON.stringify(s.map(x => [x.heading, x.text])));
}

/* Both link syntaxes must yield the mod id, because the id is what makes a
 * target unambiguous and cleaning the markup destroys it. */
{
  const bb = 'Requires [url=https://www.nexusmods.com/baldursgate3/mods/87]Basket SFW[/url] first.';
  const html = 'Requires <a href="https://www.nexusmods.com/baldursgate3/mods/97">Basket NSFW</a> first.';
  check('bbcode link keeps its mod id', segments(bb)[0]?.links.includes(87));
  check('html link keeps its mod id', segments(html)[0]?.links.includes(97));
  check('bbcode link keeps its label', /Basket SFW/.test(segments(bb)[0]?.text ?? ''));
}

/* Two links in one segment must both survive: a sentence can name two mods. */
{
  const d = 'Load [url=https://www.nexusmods.com/baldursgate3/mods/1]A[/url] before '
    + '[url=https://www.nexusmods.com/baldursgate3/mods/2]B[/url].';
  const s = segments(d);
  check('two links in one segment both survive',
    s[0]?.links.length === 2 && s[0].links.includes(1) && s[0].links.includes(2),
    JSON.stringify(s[0]?.links));
}

/* A table row is a unit of advice in plenty of descriptions. */
{
  const d = '<table><tr><td>ImpUI</td><td>load first</td></tr><tr><td>Patch</td><td>load last</td></tr></table>';
  const s = segments(d);
  check('table rows do not merge into one blob',
    s.length >= 2 && !s.some(x => /load first.*load last/s.test(x.text)),
    JSON.stringify(s.map(x => x.text)));
}

/* An XML install block must not swallow the advice above it. */
{
  const d = 'Place this at the bottom of your load order.\n\n'
    + '<node id="ModuleShortDesc"><attribute id="Folder" value="Thing" /></node>';
  const s = segments(d);
  check('an xml block stays out of the sentence above it',
    s.some(x => /bottom of your load order/.test(x.text) && !/ModuleShortDesc/.test(x.text)),
    JSON.stringify(s.map(x => x.text.slice(0, 40))));
}

/* Malformed markup is the norm, not the exception. */
{
  const d = '[b]Note[/b] load this after [url=broken]X\n\nAnd keep the patch below it.';
  const s = segments(d);
  check('malformed markup does not lose the text',
    s.some(x => /load this after/.test(x.text)) && s.some(x => /keep the patch below/.test(x.text)),
    JSON.stringify(s.map(x => x.text)));
}

/* Adjacent paragraphs must not merge: they are usually different claims. */
{
  const d = 'Load this after ImprovedUI.\n\nLoad the patch after this mod.';
  const s = segments(d);
  check('adjacent paragraphs stay separate',
    s.length === 2, JSON.stringify(s.map(x => x.text)));
}

/* A sentence split across a line break inside one paragraph must not be cut,
 * which is the failure that made sentence splitting the wrong unit. */
{
  const d = 'If you use Unique Tav<br>you must load this mod after it.';
  const s = segments(d);
  check('a single break inside a thought does not split it',
    s.length === 1 && /Unique Tav you must load this mod after it/.test(s[0].text),
    JSON.stringify(s.map(x => x.text)));
}

/* Offsets must address the raw source, so a reader can widen the context. */
{
  const d = 'Intro paragraph here.\n\nPlace this last in your load order.\n\nThanks for reading.';
  const s = segments(d);
  const target = s.find(x => /Place this last/.test(x.text));
  check('offsets point back at the raw source',
    target && d.slice(target.start, target.end).includes('Place this last'));
  check('excerpt widens around a segment',
    /Intro paragraph/.test(excerpt(d, target, 60)));
}

/* Entities are decoded, since an author writing &amp; means and. */
{
  check('entities are decoded', clean('Load A &amp; B &lt;first&gt;') === 'Load A & B <first>');
}

console.log('');
if (failures) {
  console.log(`${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('segmenter: all checks passed');
