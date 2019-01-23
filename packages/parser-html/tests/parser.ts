import * as sinon from 'sinon';
import test from 'ava';
import { EventEmitter2 } from 'eventemitter2';
import { IAsyncHTMLDocument, FetchEnd } from 'hint/dist/src/lib/types';
import { Engine } from 'hint';

import * as HTMLParser from '../src/parser';
import { HTMLEvents, HTMLParse } from '../src/parser';

test('If `fetch::end::html` is received, then the code should be parsed and the `parse::end::html` event emitted', async (t) => {
    const sandbox = sinon.createSandbox();
    const engine: Engine<HTMLEvents> = new EventEmitter2({
        delimiter: '::',
        maxListeners: 0,
        wildcard: true
    }) as Engine<HTMLEvents>;
    const code = '<!DOCTYPE html><div id="test">Test</div>';
    new HTMLParser.default(engine); // eslint-disable-line

    const engineEmitAsyncSpy = sandbox.spy(engine, 'emitAsync');

    await engine.emitAsync('fetch::end::html', {
        resource: 'test.html',
        response: {
            body: { content: code },
            mediaType: 'text/html',
            url: 'test.html'
        }
    } as FetchEnd);

    const args = engineEmitAsyncSpy.args;
    const document = (args[2][1] as HTMLParse).window.document as IAsyncHTMLDocument;
    const div = (await document.querySelectorAll('div'))[0];
    const div2 = (await document.querySelectorAll('body > div'))[0];
    const location = div.getLocation();

    let id = null;

    for (let i = 0; i < div.attributes.length; i++) {
        if (div.attributes[i].name === 'id') {
            id = div.attributes[i];
            break;
        }
    }

    t.is(args[1][0], 'parse::start::html');
    t.is(args[2][0], 'parse::end::html');
    t.is((args[2][1] as HTMLParse).resource, 'test.html');
    t.is((args[2][1] as HTMLParse).html, code);
    t.is(await document.pageHTML(), '<html><head></head><body><div id="test">Test</div></body></html>');
    t.is(await div.outerHTML(), '<div id="test">Test</div>');
    t.is(div.nodeName.toLowerCase(), 'div');
    t.is(div.getAttribute('id'), 'test');
    t.is(location && location.line, 0);
    t.is(location && location.column, 16);
    t.is(id && id.value, 'test');
    t.true(div.isSame(div2));

    t.is(args[3][0], 'traverse::start');
    t.is(args[4][0], 'element::html');
    t.is(args[5][0], 'traverse::down');
    t.is(args[6][0], 'element::head');
    t.is(args[7][0], 'traverse::down');
    t.is(args[8][0], 'traverse::up');
    t.is(args[9][0], 'element::body');
    t.is(args[10][0], 'traverse::down');
    t.is(args[11][0], 'element::div');
    t.is(args[12][0], 'traverse::down');
    t.is(args[13][0], 'traverse::up');
    t.is(args[14][0], 'traverse::up');
    t.is(args[15][0], 'traverse::up');
    t.is(args[16][0], 'traverse::end');

    sandbox.restore();
});

test('The `parse::end::html` event should include a window with support for evaluating script', async (t) => {
    const sandbox = sinon.createSandbox();
    const engine: Engine<HTMLEvents> = new EventEmitter2({
        delimiter: '::',
        maxListeners: 0,
        wildcard: true
    }) as Engine<HTMLEvents>;
    const code = '<!DOCTYPE html><div id="test">Test</div>';
    new HTMLParser.default(engine); // eslint-disable-line

    const engineEmitAsyncSpy = sandbox.spy(engine, 'emitAsync');

    await engine.emitAsync('fetch::end::html', {
        resource: 'test.html',
        response: {
            body: { content: code },
            mediaType: 'text/html',
            url: 'test.html'
        }
    } as FetchEnd);

    const args = engineEmitAsyncSpy.args;

    const window = (args[2][1] as HTMLParse).window;

    const result1 = await window.evaluate(`
        (function(){
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve(document.body.firstElementChild.id);
                }, 1000);
            });
        }());
    `);

    const result2 = await window.evaluate(`
        (function(){
            return document.getElementsByTagName('div')[0].textContent;
        }());
    `);

    t.is(result1, 'test');
    t.is(result2, 'Test');

    sandbox.restore();
});
