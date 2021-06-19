const {
  StateTransition,
  BehaviorIdle,
  NestedStateMachine
} = require('mineflayer-statemachine')

const BehaviorLoadConfig = require('./../BehaviorModules/BehaviorLoadConfig')

function farmingFunction (bot, targets) {
  const plantType = require('../modules/plantType')
  const start = new BehaviorIdle(targets)
  start.stateName = 'Start'
  start.x = 125
  start.y = 113

  const loadConfig = new BehaviorLoadConfig(bot, targets)
  loadConfig.stateName = 'Load Bot Config'
  loadConfig.x = 325
  loadConfig.y = 113

  const exit = new BehaviorIdle(targets)
  exit.stateName = 'Exit'
  exit.x = 725
  exit.y = 113

  const checkFarmingAreas = new BehaviorIdle(targets)
  checkFarmingAreas.stateName = 'Next Area'
  checkFarmingAreas.x = 525
  checkFarmingAreas.y = 113

  const farmingPlantsFunction = require('./farmingPlantsFunction')(bot, targets)
  farmingPlantsFunction.stateName = 'Farm Plants'
  farmingPlantsFunction.x = 625
  farmingPlantsFunction.y = 313

  const farmingTreesFunction = require('./farmingTreesFunction')(bot, targets)
  farmingTreesFunction.stateName = 'Farm Trees'
  farmingTreesFunction.x = 425
  farmingTreesFunction.y = 313

  let plantArea = []
  let plantAreaIndex = 0

  const transitions = [

    new StateTransition({
      parent: start,
      child: loadConfig,
      shouldTransition: () => true
    }),

    new StateTransition({
      parent: loadConfig,
      child: checkFarmingAreas,
      onTransition: () => {
        plantAreaIndex = 0
        plantArea = loadConfig.getPlantAreas()
      },
      shouldTransition: () => true
    }),

    new StateTransition({
      parent: checkFarmingAreas,
      child: exit,
      name: 'All areas checked',
      shouldTransition: () => plantAreaIndex === (plantArea.length) || bot.inventory.items().length >= 33
    }),

    /** Plants **/
    new StateTransition({
      parent: farmingPlantsFunction,
      child: checkFarmingAreas,
      onTransition: () => plantAreaIndex++,
      shouldTransition: () => farmingPlantsFunction.isFinished()
    }),
    new StateTransition({
      parent: checkFarmingAreas,
      child: farmingPlantsFunction,
      onTransition: () => {
        targets.plantArea = plantArea[plantAreaIndex]
      },
      shouldTransition: () =>
        (
          plantType[plantArea[plantAreaIndex].plant].type === 'normal' ||
          plantType[plantArea[plantAreaIndex].plant].type === 'melon' ||
          plantType[plantArea[plantAreaIndex].plant].type === 'sweet_berries'
        ) && bot.inventory.items().length < 33
    }),
    /** END Plants **/

    /** Trees **/
    new StateTransition({
      parent: checkFarmingAreas,
      child: farmingTreesFunction,
      onTransition: () => {
        targets.plantArea = plantArea[plantAreaIndex]
      },
      shouldTransition: () => plantType[plantArea[plantAreaIndex].plant].type === 'tree' && bot.inventory.items().length < 33
    }),
    new StateTransition({
      parent: farmingTreesFunction,
      child: checkFarmingAreas,
      onTransition: () => plantAreaIndex++,
      shouldTransition: () => farmingTreesFunction.isFinished()
    })
    /** END Trees **/

  ]

  const farmingFunction = new NestedStateMachine(transitions, start, exit)
  farmingFunction.stateName = 'farmingFunction'
  return farmingFunction
}

module.exports = farmingFunction
