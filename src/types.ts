// Color type used throughout activity configuration
export interface SerializableColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

// Bubble types (using const object instead of enum for erasableSyntaxOnly)
export const BubbleType = {
  Color: 0,
  Item: 1,
  Empty: 2,
} as const;
export type BubbleType = (typeof BubbleType)[keyof typeof BubbleType];

// Bubble configuration for unlock recipes
export interface SerializableBubble {
  displayName?: string;
  bubbleType: BubbleType;
  colorName?: string;
  backgroundColor?: SerializableColor;
  itemIds?: string[];
  colorTolerance?: number;
  useHSVMatching?: boolean;
}

// Device input types (using const object instead of enum for erasableSyntaxOnly)
export const DeviceInput = {
  None: 0,
  BackBtn: 2,
  FrontBtn: 3,
  RollRight: 4,
  RollLeft: 5,
  TiltForward: 6,
  TiltBackward: 7,
  Shake: 8,
  DoubleTap: 9,
} as const;
export type DeviceInput = (typeof DeviceInput)[keyof typeof DeviceInput];

// Key action types (using const object instead of enum for erasableSyntaxOnly)
export const KeyAction = {
  Press: 0,
  Hold: 1,
  Toggle: 2,
  Continuous: 3,
} as const;
export type KeyAction = (typeof KeyAction)[keyof typeof KeyAction];

// Input mapping configuration
export interface SerializableInputMapping {
  mappingName?: string;
  enabled?: boolean;
  deviceInput: DeviceInput;
  keyboardKey: string;
  keyAction?: KeyAction;
  gyroThreshold?: number;
  gyroSensitivity?: number;
}

// Main activity data schema
export interface SerializableActivityData {
  activityName: string;
  url: string;
  iconPath?: string;
  description?: string;
  requiredLevel?: number;
  shouldUnlockByLumi?: boolean;
  isLocked?: boolean;
  activityColor?: SerializableColor;
  recipeName?: string;
  recipeDescription?: string;
  requiredBubbles?: SerializableBubble[];
  useDefaultMapping?: boolean;
  customInputMappings?: SerializableInputMapping[];
  inputUpdateRate?: number;
  departureEmotion?: string;
  arrivalEmotion?: string;
  levelUpMoveSpeed?: number;
  enableOnArrival?: boolean;
  enableDelay?: number;
  playEnableEffect?: boolean;
}

// Default values for creating new activities
export const defaultActivityData: SerializableActivityData = {
  activityName: 'New Activity',
  url: '',
  description: 'Activity description',
  requiredLevel: 1,
  shouldUnlockByLumi: false,
  isLocked: false,
  activityColor: { r: 1, g: 1, b: 1, a: 1 },
  recipeName: 'Activity Unlock Recipe',
  recipeDescription: 'Provide the required items to unlock this activity',
  requiredBubbles: [],
  useDefaultMapping: true,
  customInputMappings: [],
  inputUpdateRate: 0.01,
  departureEmotion: 'Idle',
  arrivalEmotion: 'CreateBluePrints',
  levelUpMoveSpeed: 20.0,
  enableOnArrival: true,
  enableDelay: 1.0,
  playEnableEffect: true,
};

// Default input mapping template
export const defaultInputMapping: SerializableInputMapping = {
  mappingName: 'New Mapping',
  enabled: true,
  deviceInput: DeviceInput.None,
  keyboardKey: '',
  keyAction: KeyAction.Press,
  gyroThreshold: 0.2,
  gyroSensitivity: 1.0,
};

// Default bubble template
export const defaultBubble: SerializableBubble = {
  displayName: 'New Bubble',
  bubbleType: BubbleType.Color,
  colorName: '',
  backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
  itemIds: [],
  colorTolerance: 0.15,
  useHSVMatching: false,
};

// Activity with relations (used by hook and components)
export interface ActivityWithRelations {
  id: string;
  name: string;
  url: string;
  icon?: string;
  activityConfig: SerializableActivityData;
  createdAt: number;
  updatedAt: number;
}

// Form data for creating/updating activities
export type ActivityFormData = Omit<ActivityWithRelations, 'id' | 'createdAt' | 'updatedAt'>;

// Legacy alias for compatibility
export type ProjectManifest = ActivityWithRelations;
export type ProjectFormData = ActivityFormData;

// Device input labels for UI
export const deviceInputLabels: Record<DeviceInput, string> = {
  [DeviceInput.None]: 'None',
  [DeviceInput.BackBtn]: 'Back Button',
  [DeviceInput.FrontBtn]: 'Front Button',
  [DeviceInput.RollRight]: 'Roll Right',
  [DeviceInput.RollLeft]: 'Roll Left',
  [DeviceInput.TiltForward]: 'Tilt Forward',
  [DeviceInput.TiltBackward]: 'Tilt Backward',
  [DeviceInput.Shake]: 'Shake',
  [DeviceInput.DoubleTap]: 'Double Tap',
};

// Key action labels for UI
export const keyActionLabels: Record<KeyAction, string> = {
  [KeyAction.Press]: 'Press',
  [KeyAction.Hold]: 'Hold',
  [KeyAction.Toggle]: 'Toggle',
  [KeyAction.Continuous]: 'Continuous',
};

// Bubble type labels for UI
export const bubbleTypeLabels: Record<BubbleType, string> = {
  [BubbleType.Color]: 'Color',
  [BubbleType.Item]: 'Item',
  [BubbleType.Empty]: 'Empty',
};

// Common keyboard keys for dropdown
export const commonKeyboardKeys = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Enter',
  'Escape',
  'KeyA',
  'KeyB',
  'KeyC',
  'KeyD',
  'KeyE',
  'KeyF',
  'KeyW',
  'KeyS',
  'Digit1',
  'Digit2',
  'Digit3',
  'ShiftLeft',
  'ControlLeft',
];
