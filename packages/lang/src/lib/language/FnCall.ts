import { evalExpression } from '../help'
import Lambda from './Lambda'
import type Env from './Env'

class FnCall {
  constructor (public name: string, public expressions: any[]) {}

  eval (env: Env) {
    const name = this.name
    const fun = env.get(name)

    if (fun === undefined) throw new Error(`Function "${name}" not defined`)

    const args = this.expressions.map(exp => evalExpression(exp, env))

    if (fun instanceof Lambda) {
      return fun.eval(env, args)
    }

    if (typeof fun === 'function') {
      return fun(...args)
    }

    return fun
  }

  toString () {
    return `(${this.name} ${this.expressions.map(a => a.toString()).join(' ')})`
  }
}

export default FnCall
