import json_style from './json_style.test'
import line from './line.test'
import symbolizer from './symbolizer.test'
import text from './text.test'
import tilecache from './tilecache.test'
import view from './view.test'

!(async function() {
  await json_style.run()
  await line.run()
  await symbolizer.run()
  await text.run()
  await tilecache.run()
  await view.run()
})()
