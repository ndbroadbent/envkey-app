import React from 'react'
import R from 'ramda'
import h from 'lib/ui/hyperscript_with_helpers'
import FormEntryCell from './env_cell/form_entry_cell'
import FormValCell from './env_cell/form_val_cell'
import LockedFormValCell from './env_cell/locked_form_val_cell'
import EditableCellsParent from './traits/editable_cells_parent'
import { allEntries } from 'lib/env/query'

const entryEditing = { entryKey: 'entry', environment: null },
  defaultEditing = props => {
    if (props.subEnvId && allEntries(props.envsWithMeta).length > 0) {
      return {}
    } else {
      return entryEditing
    }
  },
  defaultState = props => ({
    envsWithMeta: props.environmentsAssignable.reduce((acc, environment) => {
      return {
        ...acc,
        [environment]: {
          entry: { val: null, inherits: null },
        },
      }
    }, {}),
    editing: defaultEditing(props),
    didCommit: {},
    entryKey: '',
    hoveringVals: false,
  })

export default class EntryFormRow extends EditableCellsParent(React.Component) {
  constructor(props) {
    super(props)
    this.state = defaultState(props)
  }

  componentWillReceiveProps(nextProps) {
    if (
      this.props.subEnvId != nextProps.subEnvId ||
      (this.props.app && nextProps.app && this.props.app.id != nextProps.app.id)
    ) {
      this.setState(defaultState(nextProps))
    }

    // ensures entry field is de-focused after first sub-env entry is added to prevent autocomplete list blocking grid
    if (
      this.props.subEnvId &&
      nextProps.subEnvId &&
      this.props.subEnvId == nextProps.subEnvId &&
      allEntries(this.props.envsWithMeta).length == 0 &&
      allEntries(nextProps.envsWithMeta).length == 1
    ) {
      this.setState(defaultState(nextProps))
    }
  }

  componentWillUpdate(nextProps, nextState) {
    if (
      !this._isEditing(this.state) &&
      this._isEditing(nextState) &&
      !this._formEmpty(nextState)
    ) {
      this._addingEntry()
    }
  }

  formData() {
    return {
      entryKey: this.state.entryKey,
      vals: this._vals(),
      subEnvId: this.props.subEnvId,
    }
  }

  reset() {
    this.setState(defaultState(this.props))
  }

  _deselect(isEscapeKey) {
    if (isEscapeKey) {
      const environment = this.state.editing.environment,
        defaultVal = defaultState(this.props).envsWithMeta[environment].entry

      this.setState(
        R.assocPath(['envsWithMeta', environment, 'entry'], defaultVal)
      )
    }

    super._deselect()
    this.props.stoppedEditing(true)
  }

  _addingEntry() {
    this.props.addingEntry(this.props.subEnvId)
  }

  _onChangeFn(prevState) {
    return nextState => {
      if (this._formEmpty(prevState) && !this._formEmpty(nextState)) {
        this.props.addingEntry(this.props.subEnvId)
      } else if (this._formEmpty(nextState) && !this._formEmpty(prevState)) {
        this.props.stoppedAddingEntry()
      }
    }
  }

  _getOnEditCell(environment) {
    return ({
      entryKey,
      editEnvironment,
      subEnvId,
      isMultiline,
      autocompleteOpen,
    }) => {
      this.setState({ editing: { entryKey: 'entry', environment } })
      this.props.editCell({
        environment,
        subEnvId,
        isMultiline,
        autocompleteOpen,
        entryKey: null,
        isEntryForm: true,
      })
    }
  }

  _getOnCommit(environment) {
    return update => {
      this.setState(
        R.pipe(
          R.assocPath(['envsWithMeta', environment, 'entry'], update),
          R.assocPath(['didCommit', environment], true)
        )
      )
      this._clearEditing()
      this.props.updateEntryVal(
        null,
        environment,
        update,
        this.props.subEnvId,
        true
      )
    }
  }

  _getOnChange(environment) {
    return val => {
      let state = this.state
      this.setState(
        R.assocPath(['envsWithMeta', environment, 'entry'], {
          val,
          inherits: null,
        }),
        this._onChangeFn(state)
      )
    }
  }

  _formEmpty(state = null) {
    return !this._hasEntry(state) && this._valsEmpty(state)
  }

  _hasEntry(state = null) {
    return Boolean((state || this.state).entryKey)
  }

  _valsEmpty(state = null) {
    return R.pipe(
      R.values,
      R.none(
        R.pipe(
          R.props(['val', 'inherits']),
          R.any(Boolean)
        )
      )
    )(this._vals(state))
  }

  _vals(state = null) {
    return R.mapObjIndexed(R.prop('entry'), (state || this.state).envsWithMeta)
  }

  _preventClearEditingSelector() {
    return '.entry-form .cell'
  }

  _clearEditing() {
    this.setState({ editing: {} })
  }

  _isEditing(state = null) {
    return !R.isEmpty((state || this.state).editing)
  }

  _isEditingEntry() {
    return (
      this.state.editing.entryKey == 'entry' && !this.state.editing.environment
    )
  }

  _renderFormCell(environment) {
    if (
      this.props.app &&
      this.props.app.role == 'development' &&
      (environment == 'production' ||
        this.props.parentEnvironment == 'production')
    ) {
      return this._renderLockedCell()
    } else {
      return this._renderFormValCell(environment)
    }
  }

  _renderFormValCell(environment) {
    let envEntry = this.state.envsWithMeta[environment].entry

    return h(FormValCell, {
      ...envEntry, //for 'val' and 'inherits'
      environment,
      environmentLabel: this.props.subEnvName || environment,
      environments: this.props.environmentsAssignable,
      didCommit: Boolean(R.path(['didCommit', environment], this.state)),
      isEditing: this.state.editing.environment === environment,
      entryKey: 'entry',
      envsWithMeta: this.state.envsWithMeta,
      onEditCell: ::this._getOnEditCell(environment),
      onCommit: ::this._getOnCommit(environment),
      onChange: ::this._getOnChange(environment),
    })
  }

  _renderLockedCell() {
    return h(LockedFormValCell)
  }

  render() {
    const { environments } = this.props,
      formEntryCellClass = this.props.formEntryCellClass || FormEntryCell

    return h.div(
      '.row.entry-row',
      {
        className:
          (this._isEditingEntry() ? ' editing-entry' : '') +
          (this._isEditing() ? ' is-editing' : '') +
          (this._hasEntry() ? ' has-entry' : '') +
          (!this._formEmpty() ? ' not-empty' : '') +
          (this.state.hoveringVals ? ' hovering-vals' : ''),
      },
      [
        h.div('.entry-col', [
          h(formEntryCellClass, {
            ...this.props,
            onEditCell: () => {
              this._deselect()
              this.setState({ editing: entryEditing })
            },
            onAddingEntry: ::this._addingEntry,
            onCommit: ({ val }) => {
              this.setState({ entryKey: val })
              this._clearEditing()
            },
            onChange: val => {
              let state = this.state
              this.setState({ entryKey: val }, this._onChangeFn(state))
            },
            val: this.state.entryKey,
            isEditing: this._isEditingEntry(),
          }),
        ]),

        h.div(
          '.val-cols',
          {
            onMouseOver: () => this.setState({ hoveringVals: true }),
            onMouseOut: () => this.setState({ hoveringVals: false }),
          },
          [
            environments.map((environment, i) => {
              return h.div('.val-col', { key: i }, [
                this._renderFormCell(environment),
              ])
            }),
          ]
        ),

        h.span('.submit-prompt', [h.i('.arrow', '←'), ' Click to save']),
      ]
    )
  }
}
