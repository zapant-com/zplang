import * as path from 'node:path'
import * as fs from 'node:fs'
import clc from 'cli-color'
import { Command } from 'commander'
import { init, map } from 'ramda'
import dayjs from 'dayjs'
import voca from 'voca'
import { Strategy, analyzers } from 'zptrade-backtest'
import loadConfig from '../config'
import * as api from '../api'
import calendar from '@zapant/calendar'

const program = new Command('backtest')

class LoggerAnalyzer {
  name: string = 'logger'

  next({ strategy, date, barIndex, bars, orders }) {
    console.log(`Date: ${date}, BarIndex: ${barIndex}`)
    console.log(`Cash: ${strategy.broker.getCash()}`)
    console.log(`Bars:`)
    console.dir(bars, { depth: null, colors: true })
    // console.log(strategy.broker.getOpenPositions())
  }
}

export default () => {
  program
    .usage('<file> [options]')
    .description('run a backtest using a .zp or .js file and display the result')
    .argument('file', 'strategy to backtest')
    .option('-d1, --startDate <startDate>', 'backtest start date')
    .option('-d2, --endDate <endDate>', 'backtest end date')
    .option('-m, --market <market>', 'market to use', 'stocks')
    .option('-s, --save <file>', 'save result to file')
    .option('-v, --verbose', 'verbose mode', false)
    .option('-a, --analyzers <analyzers...>', 'analyzers to use')
    .action(async (file, opts) => {

      try {
        const config = await loadConfig()
        const extension = path.extname(file)
        const lang = extension === '.js' ? 'js' : 'zp'

        console.log(clc.cyanBright(`→ Backtesting using file: `) + clc.underline(file))

        // add defaults
        opts.startDate = opts.startDate ?? config.backtest?.startDate ?? dayjs().endOf('day').subtract(1, 'week').format('YYYY-MM-DD')
        opts.endDate = opts.endDate ?? config.backtest?.endDate ?? dayjs().endOf('day').format('YYYY-MM-DD')
        opts.save = opts.save ?? config.backtest?.saveResult
        opts.market = opts.market ?? config.backtest?.market ?? 'stocks'

        const dates = calendar.getDays({ start: opts.startDate, end: opts.endDate }, opts.market).map(x => x.date) //allDatas[0].map(x => dayjs(x.date).format('YYYY-MM-DD')).slice(0, parseInt(opts.window)).reverse()
        const window = dates.length

        // 1. Download bars
        const code = api.code().readCode(file)
        const strategy = new Strategy({ code, lang, verbose: opts.verbose, inputs: config.backtest?.inputs ?? {} })

        //strategy.addAnalyzer(new LoggerAnalyzer())
        const availableAnalyzers = Object.values(analyzers).reduce((result, AnalyzerClass) => {
          try {
            const analyzer = new AnalyzerClass()
            result[analyzer.name] = analyzer
            return result
          } catch (e) {
            return result
          }
        }, {} as any)

        const analyzersList = [...config.backtest?.analyzers ?? [], ...(opts.analyzers ?? []).map(name => {
          if (!availableAnalyzers[name]) {
            console.warn(clc.yellow(`→ Warning: Analyzer ${clc.underline.bold(name)} not found`))
          }

          return availableAnalyzers[name]
        }).filter(x => x)]

        strategy.addAnalyzers(analyzersList)
        console.log('')

        const { symbols, maxWindow, settings } = api.code().getSymbols(code, lang, [], config.backtest?.inputs ?? {})
        const bars: Record<string, any[]> = await api.data(config).downloadBars(symbols, maxWindow + window, settings.timeframe ?? 1440, opts.endDate)

        // 2. Run backtest
        const allDatas: any[] = Object.values(bars)

        if (allDatas.length === 0) {
          throw new Error('No data in automation for backtest')
        }

        strategy.start()

        console.log(clc.cyanBright(`→ Running backtest from ${clc.green(dates[0])} to ${clc.green(dates[dates.length - 1])}. ${clc.underline(dates.length + ' bars\n')}`))

        for (let index = 0; index < dates.length; index++) {
          const date = dates[index];
          const barIndex = index + 1
          const currentBars = map(arr => arr.concat().reverse().slice(0, index + maxWindow + 1).reverse(), bars)
          const context = { code, date, barIndex }

          strategy.setBarIndex(barIndex)
          strategy.setBars(currentBars)
          strategy.prenext(context)
          strategy.next(context)

        }

        // 3. Finalize backtest
        strategy.end()

        console.log('')
        console.log(`${clc.green('✔ Success:')} Backtest was executed successfully`)
        console.log(`${clc.green('✔ Execution time:')} ${clc.bold(strategy.duration.toFixed(2))} seconds\n`)

        const result: any = {
          startCash: strategy.broker.getCashStart(),
          endCash: strategy.broker.getCash(),
          pl: strategy.broker.getPL(),
        }

        console.log(clc.cyanBright(`→ Result: `))
        console.dir(result, { depth: null, colors: true })
        console.log('')

        result.analyzers = {}

        for (const analyzer of strategy.analyzers) {
          result.analyzers[analyzer.name] = analyzer.data
          console.log(clc.cyanBright(`→ Analyzer: `) + clc.underline(voca.capitalize(analyzer.name)))
          // console.dir(analyzer.data, { depth: null, colors: true })
          analyzer.toConsole()
          console.log('')
        }

        if (opts.save) {
          const filePath = path.join(process.cwd(), opts.save)
          console.log(clc.cyanBright(`→ Saving result to file: `) + clc.underline(filePath))

          result.file = file
          result.dateGenerated = new Date().toISOString()

          fs.writeFileSync(filePath, JSON.stringify(result, null, 2))
          console.log(`${clc.green('✔ Success:')} Result saved successfully\n`)
        }

      } catch (e: any) {
        console.error(clc.red(`Error: ${e.message}`))
      }

    })

  return program
}