import { useState } from 'react';
import { useMarketStore } from '../../store/marketStore';
import type { Scenario } from '../../types';

interface DialogState {
  type: null | 'saveAsNew' | 'rename' | 'delete' | 'resetConfirm' | 'unsavedSwitch';
  scenarioId?: string;
  scenarioName?: string;
  nextScenarioId?: string;
}

export function ScenarioManager() {
  const scenarios = useMarketStore(s => s.scenarios);
  const currentScenario = useMarketStore(s => s.currentScenario);
  const hasUnsavedChanges = useMarketStore(s => s.hasUnsavedChanges);
  const loadScenario = useMarketStore(s => s.loadScenario);
  const saveChanges = useMarketStore(s => s.saveChanges);
  const saveAsNew = useMarketStore(s => s.saveAsNew);
  const renameScenario = useMarketStore(s => s.renameScenario);
  const deleteScenario = useMarketStore(s => s.deleteScenario);
  const resetToDefault = useMarketStore(s => s.resetToDefault);

  const [isOpen, setIsOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ type: null });
  const [inputValue, setInputValue] = useState('');

  const handleScenarioSelect = (scenarioId: string) => {
    if (scenarioId === currentScenario.id) {
      setIsOpen(false);
      return;
    }

    if (hasUnsavedChanges) {
      setDialog({ type: 'unsavedSwitch', nextScenarioId: scenarioId });
    } else {
      loadScenario(scenarioId);
      setIsOpen(false);
    }
  };

  const handleSaveAsNew = () => {
    if (inputValue.trim()) {
      saveAsNew(inputValue.trim());
      setDialog({ type: null });
      setInputValue('');
      setIsOpen(false);
    }
  };

  const handleRename = () => {
    if (inputValue.trim() && dialog.scenarioId) {
      renameScenario(dialog.scenarioId, inputValue.trim());
      setDialog({ type: null });
      setInputValue('');
      setIsOpen(false);
    }
  };

  const handleDelete = () => {
    if (dialog.scenarioId) {
      deleteScenario(dialog.scenarioId);
      setDialog({ type: null });
      setIsOpen(false);
    }
  };

  const handleResetToDefault = () => {
    resetToDefault();
    setDialog({ type: null });
    setIsOpen(false);
  };

  const handleUnsavedSwitchSaveAsNew = () => {
    saveAsNew(`${currentScenario.name} (modified)`);
    if (dialog.nextScenarioId) {
      loadScenario(dialog.nextScenarioId);
    }
    setDialog({ type: null });
    setIsOpen(false);
  };

  const handleUnsavedSwitchDiscard = () => {
    if (dialog.nextScenarioId) {
      loadScenario(dialog.nextScenarioId);
    }
    setDialog({ type: null });
    setIsOpen(false);
  };

  const displayName = `${currentScenario.name}${hasUnsavedChanges ? ' *' : ''}`;
  const savedScenarios = scenarios.filter(s => s.id !== 'default');

  return (
    <>
      {/* Scenario manager bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Current scenario display + dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors"
            >
              <span className="text-sm font-semibold text-purple-900">{displayName}</span>
              <svg className={`w-4 h-4 text-purple-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {isOpen && (
              <div className="absolute top-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg z-50 w-48">
                <div className="py-1 max-h-64 overflow-y-auto">
                  {/* Default scenario */}
                  <button
                    onClick={() => handleScenarioSelect('default')}
                    className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                      currentScenario.id === 'default'
                        ? 'bg-purple-50 text-purple-900'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Equal (default) {currentScenario.id === 'default' && '✓'}
                  </button>

                  {savedScenarios.length > 0 && <div className="border-t border-gray-100 my-1" />}

                  {/* Saved scenarios (alphabetically) */}
                  {savedScenarios
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(scenario => (
                      <button
                        key={scenario.id}
                        onClick={() => handleScenarioSelect(scenario.id)}
                        className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                          currentScenario.id === scenario.id
                            ? 'bg-purple-50 text-purple-900'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {scenario.name} {currentScenario.id === scenario.id && '✓'}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
            <button
              onClick={() => {
                setInputValue('');
                setDialog({ type: 'saveAsNew' });
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors"
            >
              Save as new
            </button>

            <button
              onClick={() => saveChanges()}
              disabled={!hasUnsavedChanges || currentScenario.id === 'default'}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={currentScenario.id === 'default' ? 'Cannot save Default scenario' : 'Save changes to current scenario'}
            >
              Save changes
            </button>

            <button
              onClick={() => {
                setInputValue(currentScenario.name);
                setDialog({ type: 'rename', scenarioId: currentScenario.id });
              }}
              disabled={currentScenario.id === 'default'}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Rename
            </button>

            <button
              onClick={() => setDialog({ type: 'delete', scenarioId: currentScenario.id })}
              disabled={currentScenario.id === 'default'}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Delete
            </button>

            <button
              onClick={() => setDialog({ type: 'resetConfirm' })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Reset to Default
            </button>
          </div>
        </div>
      </div>

      {/* Dialogs */}

      {/* Save as new dialog */}
      {dialog.type === 'saveAsNew' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg px-6 py-4 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Save as new scenario</h2>
            <input
              autoFocus
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveAsNew();
                if (e.key === 'Escape') setDialog({ type: null });
              }}
              placeholder="Scenario name (e.g. 'High Supply Focus')"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveAsNew}
                disabled={!inputValue.trim()}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-40"
              >
                Save
              </button>
              <button
                onClick={() => setDialog({ type: null })}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename dialog */}
      {dialog.type === 'rename' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg px-6 py-4 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Rename scenario</h2>
            <input
              autoFocus
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setDialog({ type: null });
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleRename}
                disabled={!inputValue.trim()}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-40"
              >
                Rename
              </button>
              <button
                onClick={() => setDialog({ type: null })}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {dialog.type === 'delete' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg px-6 py-4 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete scenario?</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete "{currentScenario.name}". This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDialog({ type: null })}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset to default confirmation */}
      {dialog.type === 'resetConfirm' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg px-6 py-4 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Reset to Default?</h2>
            <p className="text-sm text-gray-600 mb-4">
              Discard current changes and load Default scenario? All metric weights will be reset to even distribution.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleResetToDefault}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => setDialog({ type: null })}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved changes when switching */}
      {dialog.type === 'unsavedSwitch' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg px-6 py-4 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Unsaved changes</h2>
            <p className="text-sm text-gray-600 mb-4">
              You have unsaved changes to "{currentScenario.name}". Save them as a new scenario?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleUnsavedSwitchSaveAsNew}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
              >
                Save as new
              </button>
              <button
                onClick={handleUnsavedSwitchDiscard}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={() => setDialog({ type: null })}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
