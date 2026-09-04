import type React from "react";

declare global {
  namespace JSX {
    type Element = React.JSX.Element;
    interface IntrinsicElements extends React.JSX.IntrinsicElements {}
    interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
    interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
  }
}

/**
 * react-native-web renders `dataSet` entries as `data-*` attributes, which is how
 * glass surfaces opt into the injected CSS backdrop filters.
 */
declare module "react-native" {
  type WebDataSet = Record<string, string | number | boolean | undefined>;

  interface ViewProps {
    dataSet?: WebDataSet;
  }

  interface TextProps {
    dataSet?: WebDataSet;
  }

  interface PressableProps {
    dataSet?: WebDataSet;
    /** react-native-web forwards ARIA props straight to the DOM node. It does not read
     *  `accessibilityState`, so anything a screen reader needs is passed explicitly. */
    "aria-checked"?: boolean;
    "aria-expanded"?: boolean;
    "aria-selected"?: boolean;
  }

  interface ScrollViewProps {
    dataSet?: WebDataSet;
  }

  interface TextInputProps {
    dataSet?: WebDataSet;
  }
}

export {};
