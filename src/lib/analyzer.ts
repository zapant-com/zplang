import type { MatchResult, Grammar, Node } from 'ohm-js'
import { FnCall, BinaryExpression, Expression, Variable, VarDec, Strlit, List, FnDec, IfElse, Loop, Obj, ObjGet, Asset, Assets } from './language'

const createSemantics = (grammar: Grammar, match: MatchResult) => {
  const semantics = grammar.createSemantics()
  const ast = {
    Program (stmts) {
      return stmts.children.map(s => s.ast())
    },
    Stmt_if (_l, _if, exp, yesStmt, noStmt, _r) {
      return new IfElse(exp.ast(), yesStmt.ast(), noStmt.ast())
    },
    Stmt_loop (_l, _loop, id, _in, list, block, _p2) {
      return new Loop(id.sourceString, list.ast(), block.ast())
    },
    Stmt_fnDec (_left, _fn, args, block, _right) {
      return new FnDec(args.ast(), block.ast())
    },
    Stmt_fnCall (_left, fnName, args, _right) {
      return new FnCall(fnName.sourceString, args.ast())
    },
    Stmt_objGet (_l, _dots, id, obj, _r) {
      return new ObjGet(id.sourceString, obj.ast())
    },
    Stmt_varDec (_left, _def, id: Node, exp: Node, _right) {
      const variable = new Variable(id.sourceString, 'any')
      const initializer = exp.ast()

      // context.set(variable.name, variable)
      return new VarDec(variable, initializer)
    },
    // Exp_binary (left, op, right) {
    //   return new BinaryExpression(op.sourceString, left.ast(), right.ast())
    // },
    Exp (val: Node) {
      return new Expression(val.ast())
    },
    Assets (_l, symbol, _c, w, _b, _r) {
      return new Assets(symbol.ast(), w.ast())
    },
    Asset (_l, symbol, daysAgo, _r) {
      return new Asset(symbol.ast(), daysAgo.ast()[0] ?? 0)
    },
    DaysAgo_nb (_c, daysAgo, _w) {
      return daysAgo.ast()
    },
    DaysAgo_today (_c, _today) {
      return 0
    },
    DaysAgo_yesterday (_c, _yesterday) {
      return 1
    },
    List (p1, expressions, p2) {
      return new List(expressions.asIteration().children.map(c => c.ast()))
    },
    Object (_l, body, _r) {
      return new Obj(body.asIteration().children.map(s => s.ast()))
    },
    ObjItem (id, _dots, exp) {
      return [id.sourceString, exp.ast()]
    },
    ListArgs (_l, args, _r) {
      return args.asIteration().children.map(c => c.sourceString)
    },
    Var (val) {
      return new Variable(val.sourceString, 'any')
    },
    true (_) {
      return true
    },
    false (_) {
      return false
    },
    intlit (sign, digits) {
      return parseInt(sign.sourceString + digits.sourceString)
    },
    floatlit (digits1: Node, _dot, digits2: Node) {
      return parseFloat(digits1.sourceString + '.' + digits2.sourceString)
    },
    strlit (_a1, chars: Node, _a2) {
      return new Strlit(chars.ast().join(''))
    },
    null (val) {
      return null
    },
    _terminal () {
      return (this as any).sourceString
    },
    _iter (...children: Node[]) {
      return children.map(c => c.ast())
    }
  }

  semantics.addOperation('ast', ast)

  return semantics
}

export default {
  createSemantics
}
