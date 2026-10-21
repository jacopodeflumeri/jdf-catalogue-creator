/**
 * Customer Preview ("View as customer") — UI components (client-safe).
 * See docs/template/capabilities/CUSTOMER_PREVIEW.md.
 *
 * `CustomerPreviewBanner` and `CustomerPreviewNotice` have no hooks and render
 * on the server too; `CustomerPreviewLauncher` is a client component.
 */
export * from "./index";

export { default as CustomerPreviewBanner } from "./components/CustomerPreviewBanner";
export { default as CustomerPreviewNotice } from "./components/CustomerPreviewNotice";
export {
  default as CustomerPreviewLauncher,
  type CustomerPreviewLauncherProps,
  type CustomerPreviewWorkspaceOption,
} from "./components/CustomerPreviewLauncher";
