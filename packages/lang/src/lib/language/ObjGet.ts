// import { evalExpression } from '../help'

class ObjGet {
  constructor (public id: any, public variable: any) {}

  eval (env) {
    const obj = this.variable.eval(env)

    if (obj === null || obj === undefined) {
      return null
    }

    if (Array.isArray(obj)) {
      return obj.map(o => o[this.id])
    }

    if (obj[this.id] === undefined) {
      return null
    } // throw Error(`Key "${this.id}" not defined in object ${this.variable.name}`)

    return obj[this.id]
  }

  toString () {
    return '(:' + this.id + ' ' + this.variable.name + ')'
  }
}

export default ObjGet
