import db from 'lib/db'
import { defaultMemoize } from 'reselect'
import R from 'ramda'
import merge from 'lodash/merge'
import {
  getUser,
  getSelectedObject,
  getSelectedObjectType,
} from './object_selectors'
import { getEnvironmentsAccessibleWithSubEnvs } from './auth_selectors'
import { getSelectedParentEnvUpdateId, getSubEnvs } from './env_selectors'
import { anonymizeEnvStatus, statusKeysToArrays } from 'lib/env/update_status'
import { allEntriesWithSubEnvs } from 'lib/env/query'

const getUserByIdFn = state => R.flip(getUser)(state),
  getSocketIsUpdatingEnvs = db('socketIsUpdatingEnvs').find()

export const getSocketEnvsStatus = defaultMemoize(state => {
    return R.pipe(
      R.mapObjIndexed((byEnvUpdateId, userId) => {
        const evolveFn = R.pipe(
          R.map(R.curry(R.assocPath)(R.__, getUser(userId, state), {})),
          R.reduce(R.mergeDeepRight, {})
        )
        return R.pipe(
          R.map(
            R.evolve({
              removingEntry: evolveFn,
              editingEntry: evolveFn,
              editingEntryVal: evolveFn,
              addingEntry: R.pipe(
                R.map(subEnvId => ({ [subEnvId]: [getUser(userId, state)] })),
                R.mergeAll
              ),
            })
          ),
          R.values,
          R.reduce(R.mergeDeepRight, {})
        )(byEnvUpdateId)
      }),
      R.values,
      R.reduce(R.mergeDeepRight, {})
    )(state.socketEnvsStatus)
  }),
  getSocketUserUpdatingEnvs = R.curry((id, state) => {
    const userId = getSocketIsUpdatingEnvs(id)(state)
    return userId ? getUser(userId)(state) : null
  }),
  getSocketRemovingEntry = R.pipe(
    getSocketEnvsStatus,
    R.propOr({}, 'removingEntry')
  ),
  getSocketEditingEntry = R.pipe(
    getSocketEnvsStatus,
    R.propOr({}, 'editingEntry')
  ),
  getSocketEditingEntryVal = R.pipe(
    getSocketEnvsStatus,
    R.propOr({}, 'editingEntryVal')
  ),
  getSocketAddingEntry = R.pipe(
    getSocketEnvsStatus,
    R.propOr({}, 'addingEntry')
  ),
  getAnonSocketEnvsStatus = state => {
    const parent = getSelectedObject(state),
      parentType = getSelectedObjectType(state),
      envUpdateId = getSelectedParentEnvUpdateId(state),
      environments = getEnvironmentsAccessibleWithSubEnvs(parent.id, state),
      subEnvs = getSubEnvs(parent.id, state),
      entries = allEntriesWithSubEnvs(parent.envsWithMeta),
      local = { [envUpdateId]: state.localSocketEnvsStatus },
      merged = merge({}, local, state.pendingLocalSocketEnvsStatus),
      mergedWithStatusKeyArrays = R.map(statusKeysToArrays, merged),
      anon = anonymizeEnvStatus(
        mergedWithStatusKeyArrays,
        entries,
        environments,
        subEnvs
      )

    return anon
  }
