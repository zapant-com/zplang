import * as core from '../modules'

interface Module {
  name: string
  namespace: string
  load: (env: Env, as?: string) => void
}

interface EnvOptions {
  parent?: Env
  isMeta?: boolean
  bars?: Record<string, any[]>
}

class Env {
  private readonly env: Record<string, any>
  private readonly parent: Env | null = null
  private readonly modules: Record<string, Module> = {}

  constructor (options: EnvOptions = {}) {
    this.parent = options.parent ?? null
    this.env = {
      $$bars: options.bars ?? [],
      $$isMeta: options.isMeta ?? false,
      $$assets: {},
      $$stdout: []
    }

    this.loadModule(core.core)
    this.loadModule(core.assets)

    this.registerModule(core.indicators)
    this.registerModule(core.trading)
  }

  bind (name: string, value: unknown) {
    const [a, b] = name.split('/')

    if (a && b) {
      this.env[a] = this.env[a] ?? {}
      this.env[a][b] = value

      return
    }

    this.env[a] = value
  }

  public get stdout () {
    return this.env.$$stdout.join('\n')
  }

  get (name: string) {
    const [a, b] = name.split('/')

    if (a && b) {
      if (this.env[a] === undefined) {
        throw new Error(`Module "${a}" not required`)
      }

      if (this.env[a][b] === undefined) {
        throw new Error(`"${b}" not defined`)
      }

      if (this.env[a][b].bind !== undefined) {
        return this.env[a][b].bind(this.env[a])
      }

      return this.env[a][b]
    }

    if (this.env[a] === undefined) {
      throw new Error(`"${a}" not defined`)
    }

    return this.env[a]
  }

  loadModule (m: Module, as?: string) {
    m.load(this, as)
  }

  loadModuleByName (name: string, as?: string) {
    const m = this.modules[name]

    if (!m) {
      throw new Error(`Module ${name} not registered`)
    }

    m.load(this, as)
  }

  registerModule (m: Module) {
    const ns = m.namespace + '/' + m.name
    this.modules[ns] = m
  }

  loadBars (bars = {}) {
    this.env.$$bars = bars
  }

  addAsset (symbol: string, window: number) {
    if (this.parent) {
      return this.parent.addAsset(symbol, window)
    }

    const asset = { symbol, window: Math.max(this.env.$$assets[symbol] ?? 1, window) }
    this.env.$$assets[symbol] = asset.window
    return asset
  }

  print (line: string) {
    this.env.$$stdout.push(line)
  }

  clear () {
    this.env.$$stdout = []
  }

  getAssets (): Record<string, number> {
    return { ...this.env.$$assets }
  }

  getBars () {
    return this.env.$$bars
  }

  // this could be replaced with parentEnv and "looking up" if something is not found
  duplicate () {
    const dupEnv = new Env()

    Object.entries(this.env).forEach(([key, value]) => {
      dupEnv.bind(key, value)
    })

    return dupEnv
  }
}

export default Env
