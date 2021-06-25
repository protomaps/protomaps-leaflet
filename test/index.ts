import json_style from './json_style.test'
import line from './line.test'
import symbolizer from './symbolizer.test'
import text from './text.test'
import tilecache from './tilecache.test'
import view from './view.test'

(async function() {
    let r = []
    r.push(await json_style.run())
    r.push(await line.run())
    r.push(await symbolizer.run())
    r.push(await text.run())
    r.push(await tilecache.run())
    r.push(await view.run())
    if (process.env.CI && !r.every(Boolean)) process.exit(1)
})()
