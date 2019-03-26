const { RTMClient, WebClient } = require('@slack/client')

class TodoStarBot {
  constructor(options) {
    options = Object.assign(
      {
        todoReactions: ['memo'],
        startReactions: ['white_check_mark'],
        doneReactions: ['heavy_check_mark']
      },
      options
    )

    this.todoReaction = options.todoReaction || options.todoReactions[0]
    this.startReaction = options.startReaction || options.startReactions[0]
    this.doneReaction = options.doneReaction || options.doneReactions[0]

    this.rtm = options.rtm
    this.client = options.webClient

    this.todoReactionsPattern = '(?:' + options.todoReactions.join('|') + ')'
    this.startReactionsPattern = '(?:' + options.startReactions.join('|') + ')'
    this.doneReactionsPattern = '(?:' + options.doneReactions.join('|') + ')'

    this.todoCommandsPattern = '(?:' + ['todo'].join('|') + ')'
    this.startCommandsPattern = '(?:' + ['start'].join('|') + ')'
    this.doneCommandsPattern = '(?:' + ['done'].join('|') + ')'
  }

  setup() {
    this.rtm.on('message', (event) => {
      this.handleMessage(event)
        .catch(err => console.error(err))
    })
    this.rtm.on('reaction_added', (event) => {
      this.handleReactionAdded(event)
        .catch(err => console.error(err))
    })
    this.rtm.on('reaction_removed', (event) => {
      this.handleReactionRemoved(event)
        .catch(err => console.error(err))
    })

    return this
  }

  start() {
    this.rtm.start()

    return this
  }

  async handleTodoPlainCommand(channel, ts) {
    this.client.reactions.add({
      name: this.todoReaction,
      channel: channel,
      timestamp: ts
    })
  }

  async handleTodoReactionCommand(channel, ts) {
    return this.client.stars.add({
      channel: channel,
      timestamp: ts
    })
  }

  async handleTodoReactionAdded(channel, ts) {
    return this.client.stars.add({
      channel: channel,
      timestamp: ts
    })
  }

  async handleStartReactionAdded(channel, ts) {
    // do nothing
  }

  async handleDoneReactionAdded(channel, ts) {
    return this.client.stars.remove({
      channel: channel,
      timestamp: ts
    })
  }

  async handleTodoReactionRemoved(channel, ts) {
    return this.client.stars.remove({
      channel: channel,
      timestamp: ts
    })
  }

  async handleDoneReactionRemoved(channel, ts) {
    // TODO: nothing. or add star?
  }

  async handleThreadStartCommand(channel, threadTs) {
    if (!await this.isThreadMine(channel, threadTs)) {
      return
    }

    this.client.reactions.add({
      name: this.startReaction,
      channel: channel,
      timestamp: threadTs
    })
  }

  async handleThreadDoneCommand(channel, threadTs) {
    if (!await this.isThreadMine(channel, threadTs)) {
      return
    }

    this.client.reactions.add({
      name: this.doneReaction,
      channel: channel,
      timestamp: threadTs
    })
  }

  async handleMessage(event) {
    if (this.rtm.activeUserId !== event.user) {
      return
    }

    if (event.type === 'message' && !event.subtype) {
      if (event.thread_ts === undefined) {
        if (event.text.match(new RegExp(String.raw`^\s*${this.todoCommandsPattern}(?:\s|$)`))) {
          return this.handleTodoPlainCommand(event.channel, event.ts)
        }
        if (event.text.match(new RegExp(String.raw`^\s*:${this.todoReactionsPattern}:(?:\s|$)`))) {
          return this.handleTodoReactionAdded(event.channel, event.ts)
        }
      } else {
        const threadTs = event.thread_ts

        if (event.text.match(new RegExp(String.raw`^\s*${this.startCommandsPattern}(?:\s|$)`))) {
          return this.handleThreadStartCommand(event.channel, threadTs)
        }
        if (event.text.match(new RegExp(String.raw`^\s*:${this.startReactionsPattern}:(?:\s|$)`))) {
          return this.handleThreadStartCommand(event.channel, threadTs)
        }
        if (event.text.match(new RegExp(String.raw`^\s*${this.doneCommandsPattern}(?:\s|$)`))) {
          return this.handleThreadDoneCommand(event.channel, threadTs)
        }
        if (event.text.match(new RegExp(String.raw`^\s*:${this.doneReactionsPattern}:(?:\s|$)`))) {
          return this.handleThreadDoneCommand(event.channel, threadTs)
        }
      }
    }
  }

  async handleReactionAdded(event) {
    if (this.rtm.activeUserId !== event.user) {
      return
    }
    if (this.rtm.activeUserId !== event.item_user) {
      return
    }

    if (event.item.type !== 'message') {
      return
    }

    const reaction = event.reaction

    if (reaction.match(new RegExp(String.raw`^${this.todoReactionsPattern}$`))) {
      return this.handleTodoReactionAdded(event.item.channel, event.item.ts)
    }

    if (reaction.match(new RegExp(String.raw`^${this.startReactionsPattern}$`))) {
      return this.handleStartReactionAdded(event.item.channel, event.item.ts)
    }

    if (reaction.match(new RegExp(String.raw`^${this.doneReactionsPattern}$`))) {
      return this.handleDoneReactionAdded(event.item.channel, event.item.ts)
    }

    console.log(event)
  }

  async handleReactionRemoved(event) {
    if (this.rtm.activeUserId !== event.user) {
      return
    }
    if (this.rtm.activeUserId !== event.item_user) {
      return
    }
    if (event.item.type !== 'message') {
      return
    }

    const reaction = event.reaction

    if (reaction.match(new RegExp(String.raw`^${this.todoReactionsPattern}$`))) {
      return this.handleTodoReactionRemoved(event.item.channel, event.item.ts)
    }

    if (reaction.match(new RegExp(String.raw`^${this.doneReactionsPattern}$`))) {
      return this.handleDoneReactionRemoved(event.item.channel, event.item.ts)
    }

    console.log(event)
  }

  async isThreadMine(channel, threadTs) {
    const reactions = await this.client.reactions.get({
      channel: channel,
      timestamp: threadTs,
      full: false
    })

    return reactions && reactions.ok && reactions.type === 'message' && reactions.message.user === this.rtm.activeUserId
  }
}

function runTodoStarBot(args = {}) {
  const slackApiToken = args.hasOwnProperty('slackApiToken') ? args.slackApiToken : process.env.SLACK_API_TOKEN

  if (slackApiToken === undefined) {
    throw "SLACK_API_TOKEN not defined"
  }

  const client = new WebClient(slackApiToken)
  const rtm = new RTMClient(slackApiToken)

  rtm.on('ready', () => {
    console.log('ready')
  })

  const options = {
    rtm: rtm,
    webClient: client
  }

  if (process.env.hasOwnProperty('TODO_REACTIONS')) {
    options.todoReactions = process.env.TODO_REACTIONS.split(',')
  }
  if (process.env.hasOwnProperty('START_REACTIONS')) {
    options.startReactions = process.env.START_REACTIONS.split(',')
  }
  if (process.env.hasOwnProperty('DONE_REACTIONS')) {
    options.doneReactions = process.env.DONE_REACTIONS.split(',')
  }

  const bot = new TodoStarBot(options)

  bot.setup().start()
}

module.exports = {
  TodoStarBot: TodoStarBot,
  runTodoStarBot: runTodoStarBot
}
