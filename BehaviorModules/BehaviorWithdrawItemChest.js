const botWebsocket = require('@modules/botWebsocket')
const { sleep, getSecondBlockPosition } = require('@modules/utils')
const vec3 = require('vec3')

module.exports = class BehaviorWithdrawItemChest {
  constructor (bot, targets) {
    this.bot = bot
    this.targets = targets
    this.stateName = 'BehaviorWithdrawItemChest'
    this.isEndFinished = false

    this.items = []
  }

  onStateEntered () {
    this.isEndFinished = false
    this.items = [...this.targets.items]
    botWebsocket.log('Items to withdraw ' + JSON.stringify(this.items))

    this.timeLimit = setTimeout(() => {
      botWebsocket.log('Time exceded for get items, forcing close')
      this.isEndFinished = true
    }, 5000)

    this.withdrawAllItems()
  }

  onStateExited () {
    this.isEndFinished = false
    clearTimeout(this.timeLimit)
  }

  isFinished () {
    return this.isEndFinished
  }

  async withdrawAllItems () {
    const chestToOpen = this.bot.blockAt(vec3(this.targets.position))
    if (!chestToOpen) {
      return
    }

    if (!['chest', 'ender_chest', 'trapped_chest'].includes(chestToOpen.name)) {
      botWebsocket.log('No chest found')
      this.isEndFinished = true
      return
    }

    this.bot.openContainer(chestToOpen)
      .then((container) => {
        this.withdrawItem(container)
          .then(async () => {
            this.refreshChest(chestToOpen, container)
            await sleep(200)
            await container.close()
            await sleep(500)
            this.isEndFinished = true
          })
          .catch(async (err) => {
            this.refreshChest(chestToOpen, container)
            console.log(err)
            await sleep(200)
            await container.close()
            await sleep(500)
            this.isEndFinished = true
          })
      })
  }

  refreshChest (chestToOpen, container) {
    const chest = this.targets.chests.find(c => {
      if (vec3(c.position).equals(chestToOpen.position)) return true
      if (c.secondBlock && vec3(c.secondBlock.position).equals(chestToOpen.position)) return true
      return false
    })

    const slots = container.slots.slice(0, container.inventoryStart)
    if (!chest) {
      chestToOpen.slots = slots
      chestToOpen.lastTimeOpen = Date.now()

      const props = chestToOpen.getProperties()
      const offset = getSecondBlockPosition(props.facing, props.type)
      if (offset) {
        chestToOpen.secondBlock = this.bot.blockAt(chestToOpen.position.offset(offset.x, offset.y, offset.z))
      }

      this.targets.chests.push(chestToOpen)
    } else {
      chest.slots = slots
      chest.lastTimeOpen = Date.now()
    }

    botWebsocket.sendAction('setChests', this.targets.chests)
  }

  withdrawItem (container) {
    return new Promise((resolve, reject) => {
      if (this.items.length === 0) {
        resolve()
        return
      }

      const itemToWithdraw = this.items.shift()

      const foundItem = itemToWithdraw.type
        ? container.containerItems().find(i => i.type === itemToWithdraw.type)
        : container.containerItems().find(i => i.name.includes(itemToWithdraw.item))

      if (!foundItem) {
        this.withdrawItem(container)
          .then(() => {
            resolve()
          })
          .catch(err => {
            reject(err)
          })
        return
      }

      const quantity = foundItem.count < itemToWithdraw.quantity ? foundItem.count : itemToWithdraw.quantity

      if (itemToWithdraw.fromSlot !== undefined) {
        // If the source is specific
        const options = {
          windows: container,
          itemType: foundItem.type,
          metadata: null,
          count: quantity,
          sourceStart: itemToWithdraw.fromSlot,
          sourceEnd: itemToWithdraw.fromSlot + 1,
          destStart: container.inventoryStart,
          destEnd: container.inventoryEnd
        }
        this.bot.transfer(options)
          .then(() => {
            this.withdrawItem(container)
              .then(() => {
                resolve()
              })
              .catch(err => {
                reject(err)
              })
          })
          .catch(err => {
            reject(err)
          })
      } else {
        // If the source is NOT specific
        container.withdraw(foundItem.type, null, quantity)
          .then(() => {
            this.withdrawItem(container)
              .then(() => {
                resolve()
              })
              .catch(err => {
                reject(err)
              })
          })
          .catch(err => {
            reject(err)
          })
      }
    })
  }
}
