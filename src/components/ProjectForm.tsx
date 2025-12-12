import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import type {
  ProjectManifest,
  ProjectFormData,
  SerializableActivityData,
  SerializableInputMapping,
  SerializableBubble,
  SerializableColor
} from '../types';
import {
  defaultActivityData,
  defaultInputMapping,
  defaultBubble,
  DeviceInput,
  KeyAction,
  BubbleType,
  deviceInputLabels,
  keyActionLabels,
  bubbleTypeLabels,
  commonKeyboardKeys
} from '../types';
import './ProjectForm.css';

interface ProjectFormProps {
  project?: ProjectManifest;
  onSubmit: (data: ProjectFormData) => void;
  onCancel: () => void;
}

// Color picker helper component
function ColorPicker({
  color,
  onChange,
  label
}: {
  color: SerializableColor;
  onChange: (c: SerializableColor) => void;
  label: string;
}) {
  const toHex = (c: SerializableColor) => {
    const r = Math.round(c.r * 255).toString(16).padStart(2, '0');
    const g = Math.round(c.g * 255).toString(16).padStart(2, '0');
    const b = Math.round(c.b * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  };

  const fromHex = (hex: string): SerializableColor => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b, a: color.a };
  };

  return (
    <div className="color-picker">
      <label>{label}</label>
      <div className="color-picker-row">
        <input
          type="color"
          value={toHex(color)}
          onChange={(e) => onChange(fromHex(e.target.value))}
        />
        <input
          type="number"
          min="0"
          max="1"
          step="0.1"
          value={color.a}
          onChange={(e) => onChange({ ...color, a: parseFloat(e.target.value) || 1 })}
          placeholder="Alpha"
        />
      </div>
    </div>
  );
}

// Input mapping editor component
function InputMappingEditor({
  mapping,
  index,
  onChange,
  onRemove
}: {
  mapping: SerializableInputMapping;
  index: number;
  onChange: (m: SerializableInputMapping) => void;
  onRemove: () => void;
}) {
  return (
    <div className="array-item">
      <div className="array-item-header">
        <span>Mapping {index + 1}: {mapping.mappingName || 'Unnamed'}</span>
        <button type="button" className="btn-remove" onClick={onRemove}>Remove</button>
      </div>
      <div className="array-item-fields">
        <div className="form-row">
          <div className="form-group half">
            <label>Mapping Name</label>
            <input
              type="text"
              value={mapping.mappingName || ''}
              onChange={(e) => onChange({ ...mapping, mappingName: e.target.value })}
            />
          </div>
          <div className="form-group half">
            <label>Enabled</label>
            <select
              value={mapping.enabled ? 'true' : 'false'}
              onChange={(e) => onChange({ ...mapping, enabled: e.target.value === 'true' })}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group half">
            <label>Device Input</label>
            <select
              value={mapping.deviceInput}
              onChange={(e) => onChange({ ...mapping, deviceInput: parseInt(e.target.value) as DeviceInput })}
            >
              {Object.entries(deviceInputLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-group half">
            <label>Keyboard Key</label>
            <select
              value={mapping.keyboardKey || ''}
              onChange={(e) => onChange({ ...mapping, keyboardKey: e.target.value })}
            >
              <option value="">Select a key...</option>
              {commonKeyboardKeys.map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group half">
            <label>Key Action</label>
            <select
              value={mapping.keyAction ?? KeyAction.Press}
              onChange={(e) => onChange({ ...mapping, keyAction: parseInt(e.target.value) as KeyAction })}
            >
              {Object.entries(keyActionLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-group half">
            <label>Gyro Threshold</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={mapping.gyroThreshold ?? 0.2}
              onChange={(e) => onChange({ ...mapping, gyroThreshold: parseFloat(e.target.value) })}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Gyro Sensitivity</label>
          <input
            type="number"
            min="0"
            max="5"
            step="0.1"
            value={mapping.gyroSensitivity ?? 1.0}
            onChange={(e) => onChange({ ...mapping, gyroSensitivity: parseFloat(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}

// Bubble editor component
function BubbleEditor({
  bubble,
  index,
  onChange,
  onRemove
}: {
  bubble: SerializableBubble;
  index: number;
  onChange: (b: SerializableBubble) => void;
  onRemove: () => void;
}) {
  return (
    <div className="array-item">
      <div className="array-item-header">
        <span>Bubble {index + 1}: {bubble.displayName || 'Unnamed'}</span>
        <button type="button" className="btn-remove" onClick={onRemove}>Remove</button>
      </div>
      <div className="array-item-fields">
        <div className="form-row">
          <div className="form-group half">
            <label>Display Name</label>
            <input
              type="text"
              value={bubble.displayName || ''}
              onChange={(e) => onChange({ ...bubble, displayName: e.target.value })}
            />
          </div>
          <div className="form-group half">
            <label>Bubble Type</label>
            <select
              value={bubble.bubbleType}
              onChange={(e) => onChange({ ...bubble, bubbleType: parseInt(e.target.value) as BubbleType })}
            >
              {Object.entries(bubbleTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        {bubble.bubbleType === BubbleType.Color && (
          <>
            <div className="form-group">
              <label>Color Name</label>
              <input
                type="text"
                value={bubble.colorName || ''}
                onChange={(e) => onChange({ ...bubble, colorName: e.target.value })}
              />
            </div>
            <ColorPicker
              color={bubble.backgroundColor || { r: 1, g: 1, b: 1, a: 1 }}
              onChange={(c) => onChange({ ...bubble, backgroundColor: c })}
              label="Background Color"
            />
            <div className="form-row">
              <div className="form-group half">
                <label>Color Tolerance</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={bubble.colorTolerance ?? 0.15}
                  onChange={(e) => onChange({ ...bubble, colorTolerance: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group half">
                <label>Use HSV Matching</label>
                <select
                  value={bubble.useHSVMatching ? 'true' : 'false'}
                  onChange={(e) => onChange({ ...bubble, useHSVMatching: e.target.value === 'true' })}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>
          </>
        )}
        {bubble.bubbleType === BubbleType.Item && (
          <div className="form-group">
            <label>Item IDs (comma-separated)</label>
            <input
              type="text"
              value={(bubble.itemIds || []).join(', ')}
              onChange={(e) => onChange({
                ...bubble,
                itemIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
              placeholder="item1, item2, item3"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectForm({ project, onSubmit, onCancel }: ProjectFormProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('');
  const [config, setConfig] = useState<SerializableActivityData>({ ...defaultActivityData });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    unlock: false,
    input: false,
    animation: false,
  });

  useEffect(() => {
    if (project) {
      setName(project.name);
      setUrl(project.url);
      setIcon(project.icon || '');
      setConfig({ ...defaultActivityData, ...project.activityConfig });
    }
  }, [project]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    const activityConfig: SerializableActivityData = {
      ...config,
      activityName: name.trim(),
      url: url.trim(),
      iconPath: icon.trim() || undefined,
    };

    onSubmit({
      name: name.trim(),
      url: url.trim(),
      icon: icon.trim() || undefined,
      activityConfig,
    });

    if (!project) {
      setName('');
      setUrl('');
      setIcon('');
      setConfig({ ...defaultActivityData });
    }
  };

  const addInputMapping = () => {
    setConfig(prev => ({
      ...prev,
      customInputMappings: [...(prev.customInputMappings || []), { ...defaultInputMapping }]
    }));
  };

  const updateInputMapping = (index: number, mapping: SerializableInputMapping) => {
    setConfig(prev => ({
      ...prev,
      customInputMappings: (prev.customInputMappings || []).map((m, i) => i === index ? mapping : m)
    }));
  };

  const removeInputMapping = (index: number) => {
    setConfig(prev => ({
      ...prev,
      customInputMappings: (prev.customInputMappings || []).filter((_, i) => i !== index)
    }));
  };

  const addBubble = () => {
    setConfig(prev => ({
      ...prev,
      requiredBubbles: [...(prev.requiredBubbles || []), { ...defaultBubble }]
    }));
  };

  const updateBubble = (index: number, bubble: SerializableBubble) => {
    setConfig(prev => ({
      ...prev,
      requiredBubbles: (prev.requiredBubbles || []).map((b, i) => i === index ? bubble : b)
    }));
  };

  const removeBubble = (index: number) => {
    setConfig(prev => ({
      ...prev,
      requiredBubbles: (prev.requiredBubbles || []).filter((_, i) => i !== index)
    }));
  };

  return (
    <form className="project-form" onSubmit={handleSubmit}>
      <h2>{project ? 'Edit Activity' : 'Create New Activity'}</h2>

      {/* Basic Information Section */}
      <div className="form-section">
        <div className="section-header" onClick={() => toggleSection('basic')}>
          <h3>Basic Information</h3>
          <span className={`chevron ${expandedSections.basic ? 'open' : ''}`}>&#9660;</span>
        </div>
        {expandedSections.basic && (
          <div className="section-content">
            <div className="form-group">
              <label htmlFor="name">Activity Name *</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome Activity"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="url">Activity URL *</label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/game"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="icon">Icon URL (optional)</label>
              <input
                type="url"
                id="icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="https://example.com/icon.png"
              />
            </div>

            {icon && (
              <div className="icon-preview">
                <img src={icon} alt="Icon preview" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={config.description || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your activity..."
                rows={3}
              />
            </div>

            <ColorPicker
              color={config.activityColor || { r: 1, g: 1, b: 1, a: 1 }}
              onChange={(c) => setConfig(prev => ({ ...prev, activityColor: c }))}
              label="Activity Color"
            />
          </div>
        )}
      </div>

      {/* Unlock & Recipe Section */}
      <div className="form-section">
        <div className="section-header" onClick={() => toggleSection('unlock')}>
          <h3>Unlock & Recipe Settings</h3>
          <span className={`chevron ${expandedSections.unlock ? 'open' : ''}`}>&#9660;</span>
        </div>
        {expandedSections.unlock && (
          <div className="section-content">
            <div className="form-row">
              <div className="form-group half">
                <label>Required Level</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={config.requiredLevel ?? 1}
                  onChange={(e) => setConfig(prev => ({ ...prev, requiredLevel: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="form-group half">
                <label>Is Locked</label>
                <select
                  value={config.isLocked ? 'true' : 'false'}
                  onChange={(e) => setConfig(prev => ({ ...prev, isLocked: e.target.value === 'true' }))}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Should Unlock By Lumi</label>
              <select
                value={config.shouldUnlockByLumi ? 'true' : 'false'}
                onChange={(e) => setConfig(prev => ({ ...prev, shouldUnlockByLumi: e.target.value === 'true' }))}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>

            <div className="form-group">
              <label>Recipe Name</label>
              <input
                type="text"
                value={config.recipeName || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, recipeName: e.target.value }))}
                placeholder="Activity Unlock Recipe"
              />
            </div>

            <div className="form-group">
              <label>Recipe Description</label>
              <textarea
                value={config.recipeDescription || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, recipeDescription: e.target.value }))}
                placeholder="Provide the required items to unlock this activity"
                rows={2}
              />
            </div>

            <div className="array-section">
              <div className="array-header">
                <label>Required Bubbles</label>
                <button type="button" className="btn-add" onClick={addBubble}>+ Add Bubble</button>
              </div>
              {(config.requiredBubbles || []).map((bubble, index) => (
                <BubbleEditor
                  key={index}
                  bubble={bubble}
                  index={index}
                  onChange={(b) => updateBubble(index, b)}
                  onRemove={() => removeBubble(index)}
                />
              ))}
              {(config.requiredBubbles || []).length === 0 && (
                <p className="empty-message">No bubbles configured</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input Mapping Section */}
      <div className="form-section">
        <div className="section-header" onClick={() => toggleSection('input')}>
          <h3>Input Mapping</h3>
          <span className={`chevron ${expandedSections.input ? 'open' : ''}`}>&#9660;</span>
        </div>
        {expandedSections.input && (
          <div className="section-content">
            <div className="form-row">
              <div className="form-group half">
                <label>Use Default Mapping</label>
                <select
                  value={config.useDefaultMapping ? 'true' : 'false'}
                  onChange={(e) => setConfig(prev => ({ ...prev, useDefaultMapping: e.target.value === 'true' }))}
                >
                  <option value="true">Yes (Asteroids)</option>
                  <option value="false">No (Custom)</option>
                </select>
              </div>
              <div className="form-group half">
                <label>Input Update Rate (seconds)</label>
                <input
                  type="number"
                  min="0.001"
                  max="1"
                  step="0.001"
                  value={config.inputUpdateRate ?? 0.01}
                  onChange={(e) => setConfig(prev => ({ ...prev, inputUpdateRate: parseFloat(e.target.value) }))}
                />
              </div>
            </div>

            {!config.useDefaultMapping && (
              <div className="array-section">
                <div className="array-header">
                  <label>Custom Input Mappings</label>
                  <button type="button" className="btn-add" onClick={addInputMapping}>+ Add Mapping</button>
                </div>
                {(config.customInputMappings || []).map((mapping, index) => (
                  <InputMappingEditor
                    key={index}
                    mapping={mapping}
                    index={index}
                    onChange={(m) => updateInputMapping(index, m)}
                    onRemove={() => removeInputMapping(index)}
                  />
                ))}
                {(config.customInputMappings || []).length === 0 && (
                  <p className="empty-message">No custom mappings configured</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Animation & Behavior Section */}
      <div className="form-section">
        <div className="section-header" onClick={() => toggleSection('animation')}>
          <h3>Animation & Behavior</h3>
          <span className={`chevron ${expandedSections.animation ? 'open' : ''}`}>&#9660;</span>
        </div>
        {expandedSections.animation && (
          <div className="section-content">
            <div className="form-row">
              <div className="form-group half">
                <label>Departure Emotion</label>
                <input
                  type="text"
                  value={config.departureEmotion || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, departureEmotion: e.target.value }))}
                  placeholder="Idle"
                />
              </div>
              <div className="form-group half">
                <label>Arrival Emotion</label>
                <input
                  type="text"
                  value={config.arrivalEmotion || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, arrivalEmotion: e.target.value }))}
                  placeholder="CreateBluePrints"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Level Up Move Speed</label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={config.levelUpMoveSpeed ?? 20}
                onChange={(e) => setConfig(prev => ({ ...prev, levelUpMoveSpeed: parseFloat(e.target.value) }))}
              />
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label>Enable On Arrival</label>
                <select
                  value={config.enableOnArrival ? 'true' : 'false'}
                  onChange={(e) => setConfig(prev => ({ ...prev, enableOnArrival: e.target.value === 'true' }))}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div className="form-group half">
                <label>Enable Delay (seconds)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={config.enableDelay ?? 1}
                  onChange={(e) => setConfig(prev => ({ ...prev, enableDelay: parseFloat(e.target.value) }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Play Enable Effect</label>
              <select
                value={config.playEnableEffect ? 'true' : 'false'}
                onChange={(e) => setConfig(prev => ({ ...prev, playEnableEffect: e.target.value === 'true' }))}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          {project ? 'Save Changes' : 'Create Activity'}
        </button>
      </div>
    </form>
  );
}
