import { Env } from '../src/core'
import parser from '../src/parser'
import analyzer from '../src/analyzer'
import data from '../src/data'
import * as r from 'ramda'

const createAst = (code: string) => {
  const m = parser.parse(code)
  const semantics = analyzer.createSemantics(parser.getGrammar(), m)

  const ast = semantics(m).ast() as any[]
  return ast
}

describe('assets', () => {
  test('define an asset', () => {
    const ast = createAst(String.raw`
      {MSFT}
      {MSFT, 3 days ago}
    `)

    const env = new Env(data)
    const res = ast.map(stmt => stmt.eval(env))

    expect(res[0]).toMatchObject({
      symbol: 'MSFT',
      open: 331.65,
      high: 334.49,
      low: 322.5,
      close: 323.46,
      volume: 35215393,
      date: 1686110400000,
      dateFormatted: '2023-06-07T04:00:00.000Z'
    })

    // 3 days ago
    expect(res[1]).toMatchObject({
      symbol: 'MSFT',
      open: 334.247,
      high: 337.5,
      low: 332.55,
      close: 335.4,
      volume: 25177109,
      date: 1685678400000,
      dateFormatted: '2023-06-02T04:00:00.000Z'
    })
  })

  test('access asset close, open, volume', () => {
    const env = new Env(data)

    const ast = createAst(String.raw`
      (:close {MSFT})
      (:close {MSFT, 3 days ago})
      (def vol (:volume {MSFT, 2 days ago}))
      vol
    `)

    const res = ast.map(stmt => stmt.eval(env))

    expect(res[0]).toBe(323.46)
    expect(res[1]).toEqual(335.4)
    expect(res[3]).toBe(21314758)
  })

  test('get price for multiple days', () => {
    const env = new Env(data)
    env.bind('sma', (prices) => {
      return r.mean(prices)
    })

    const ast = createAst(String.raw`
      (:close {MSFT, 2 bars})
      (sma (:close {AAPL, 10 bars}))
    `)

    const res = ast.map(stmt => stmt.eval(env))

    expect(res[0]).toEqual([323.46, 333.68])
    expect(res[1].toFixed(3)).toEqual('177.247')
  })

  test('assets with variable', () => {
    const env = new Env(data)

    const ast = createAst(String.raw`
      (def x 5)
      {MSFT, x bars}
      {MSFT, x days ago}
    `)

    const res = ast.map(stmt => stmt.eval(env))

    expect(res[1].length).toEqual(5)
    expect(res[2]).toEqual({
      symbol: 'MSFT',
      open: 332.29,
      high: 335.94,
      low: 327.33,
      close: 328.39,
      volume: 45959770,
      date: 1685505600000,
      dateFormatted: '2023-05-31T04:00:00.000Z'
    })
  })

  test('assets list and window', () => {
    const metaEnv = new Env()
    metaEnv.bind('bars', () => [])
    metaEnv.bind('bar', () => ({ open: 0, close: 0, low: 0, high: 0, volume: 0, date: 0 }))

    const ast = createAst(String.raw`
      {AAPL, 2 days ago}
      (:close {MSFT, 10 bars})
      (identity (:close {AMD, 10 bars}))
      (if
        [(:close {AAPL, 8 days ago}) > 100]
          (:volume {AMD, 21 days ago})
          (:open {MSFT, 33 bars})
      )
      (def x {AAPL, 12 days ago})
      (def myObj {aapl: {AAPL, 22 days ago}, msft: {MSFT, 10 days ago}})
    `)

    // console.log(ast)
    ast.map(stmt => stmt.eval(metaEnv))

    const meta = metaEnv.getMeta('assets')
    console.log(meta)

    expect(meta.AAPL).toEqual(22)
    expect(meta.MSFT).toEqual(33)
    expect(meta.AMD).toEqual(10)
  })
})
