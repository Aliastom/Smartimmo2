/**
 * Tokens daisyUI pour une thématisation cohérente
 * Ces classes garantissent que tous les composants s'adaptent automatiquement aux changements de thème
 */

// === SURFACES ===
export const Surface = "bg-base-100 text-base-content border border-base-300";
export const SurfaceMuted = "bg-base-200 text-base-content opacity-90";
export const SurfaceElevated = "bg-base-100 text-base-content border border-base-300 shadow-lg";

// === CARDS ===
export const Card = "card bg-base-100 border border-base-300 shadow-sm";
export const CardInteractive = `${Card} hover:shadow-md transition-shadow duration-200`;
export const CardHover = `${Card} hover:-translate-y-0.5 transition-transform duration-150`;

// === BOUTONS ===
export const BtnPrimary = "btn btn-primary";
export const BtnSecondary = "btn btn-secondary";
export const BtnAccent = "btn btn-accent";
export const BtnGhost = "btn btn-ghost";
export const BtnOutline = "btn btn-outline";
export const BtnLink = "btn btn-link";

// === CHAMPS DE FORMULAIRE ===
export const Field = "input bg-base-100 text-base-content border-base-300";
export const FieldError = "input input-error bg-base-100 text-base-content border-base-300";
export const Select = "select bg-base-100 text-base-content border-base-300";
export const Textarea = "textarea bg-base-100 text-base-content border-base-300";
export const Checkbox = "checkbox checkbox-primary";
export const Radio = "radio radio-primary";

// === ÉTATS INTERACTIFS ===
export const Focus = "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100";
export const Hover = "transition-all duration-150 hover:-translate-y-0.5";
export const HoverSubtle = "transition-colors duration-150 hover:bg-base-200";

// === NAVIGATION ===
export const NavItem = "group flex items-center gap-3 px-3 py-2 rounded-lg text-base-content hover:bg-base-300 hover:text-base-content transition opacity-80 hover:opacity-100";
export const NavItemActive = "bg-primary text-primary border border-primary opacity-15";
export const NavIndicator = "w-1.5 h-6 bg-primary rounded-full";

// === TABLES ===
export const Table = "table table-zebra";
export const TableHeader = "bg-base-200 text-base-content";
export const TableRowHover = "hover:bg-base-200 opacity-60 hover:opacity-100";
export const TableCell = "border-base-300";

// === MODALS ===
export const Modal = "modal";

// === DROPDOWNS ===
export const Dropdown = "dropdown";
export const DropdownContent = "menu bg-base-100 border border-base-300 shadow-lg rounded-box";
export const DropdownItem = "text-base-content hover:bg-base-200";

// === BADGES ===
export const BadgePrimary = "badge badge-primary";
export const BadgeSecondary = "badge badge-secondary";
export const BadgeAccent = "badge badge-accent";
export const BadgeInfo = "badge badge-info";
export const BadgeSuccess = "badge badge-success";
export const BadgeWarning = "badge badge-warning";
export const BadgeError = "badge badge-error";
export const BadgeNeutral = "badge badge-neutral";

// === TABS ===
export const Tabs = "tabs tabs-boxed bg-base-200";
export const TabActive = "tab-active text-primary border-primary";

// === ALERTS & TOASTS ===
export const AlertInfo = "alert alert-info";
export const AlertSuccess = "alert alert-success";
export const AlertWarning = "alert alert-warning";
export const AlertError = "alert alert-error";

// === PAGINATION ===
export const Pagination = "join";
export const PaginationItem = "join-item btn btn-ghost";
export const PaginationItemActive = "join-item btn btn-primary";

// === SKELETONS ===
export const Skeleton = "skeleton bg-base-300 opacity-70";
export const SkeletonText = "skeleton h-4 bg-base-300 opacity-70";
export const SkeletonAvatar = "skeleton w-12 h-12 bg-base-300 opacity-70 rounded-full";

// === LAYOUTS ===
export const Topbar = "sticky top-0 z-50 bg-base-100 border-b border-base-300 h-14 px-4 flex items-center justify-between";
export const Sidebar = "sidebar bg-base-200 text-base-content border-r border-base-300";
export const MainContent = "bg-base-100 text-base-content";

// === AVATARS ===
export const Avatar = "avatar";

// === ICÔNES ===
export const IconDefault = "text-base-content opacity-70";
export const IconMuted = "text-base-content opacity-50";
export const IconAccent = "text-primary";
export const IconSuccess = "text-success";
export const IconWarning = "text-warning";
export const IconError = "text-error";
export const IconHover = "group-hover:text-base-content";
export const IconActive = "group-[.active]:text-primary";

// === MODALES ===
export const ModalBackdrop = "modal-backdrop bg-base-300 backdrop-blur-sm opacity-40";
export const ModalBox = "modal-box bg-base-100 text-base-content border border-base-300 shadow-xl";
export const ModalHeader = "text-lg font-semibold text-base-content";
export const ModalFooter = "flex justify-end gap-2";

// === DIVIDERS ===
export const Divider = "divider border-base-300";
export const DividerVertical = "divider divider-horizontal border-base-300";

// === PROGRESS ===
export const Progress = "progress bg-base-300";
export const ProgressBar = "progress bg-primary";

// === TOOLTIPS ===
export const Tooltip = "tooltip";
export const TooltipContent = "tooltip-content bg-base-content text-base-100";

// === RATING ===
export const Rating = "rating";
export const RatingStar = "mask mask-star-2 bg-warning";

// === STATS ===
export const Stats = "stats bg-base-100 border border-base-300";
export const Stat = "stat";
export const StatTitle = "stat-title text-base-content opacity-80";
export const StatValue = "stat-value text-base-content";
export const StatDesc = "stat-desc text-base-content opacity-60";

// === ACCORDION ===
export const Accordion = "collapse bg-base-100 border border-base-300";
export const AccordionTitle = "collapse-title text-base-content";
export const AccordionContent = "collapse-content text-base-content opacity-80";

// === CAROUSEL ===
export const Carousel = "carousel bg-base-100 border border-base-300 rounded-box";
export const CarouselItem = "carousel-item";

// === DRAWER ===
export const Drawer = "drawer";
export const DrawerSide = "drawer-side bg-base-200 text-base-content border-r border-base-300";
export const DrawerContent = "drawer-content bg-base-100 text-base-content";

// === COMPOSANTS COMPOSITES ===
export const SearchBar = `${Field} ${Focus}`;
export const ActionButton = `${BtnGhost} ${Focus}`;
export const InteractiveCard = `${Card} ${Hover} ${Focus}`;
export const FormGroup = "form-control";
export const FormLabel = "label-text text-base-content opacity-80";
export const FormError = "label-text-alt text-error";

// === UTILITAIRES ===
export const TextMuted = "text-base-content opacity-60";
export const TextSubtle = "text-base-content opacity-80";
export const BorderSubtle = "border-base-300";
export const ShadowSubtle = "shadow-sm";
export const ShadowMedium = "shadow-md";
export const ShadowLarge = "shadow-lg";

// === RESPONSIVE ===
export const ResponsiveGrid = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";
export const ResponsiveFlex = "flex flex-col md:flex-row gap-4";

// === ANIMATIONS ===
export const FadeIn = "animate-in fade-in duration-300";
export const SlideIn = "animate-in slide-in-from-bottom-4 duration-300";
export const ScaleIn = "animate-in zoom-in-95 duration-200";

// === ACCESSIBILITÉ ===
export const ScreenReaderOnly = "sr-only";
export const FocusVisible = "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
export const ReducedMotion = "motion-reduce:transition-none motion-reduce:hover:transform-none";

// === THÈMES SPÉCIFIQUES ===
export const ThemeTokens = {
  smartimmo: {
    primary: "bg-primary text-primary-content",
    secondary: "bg-secondary text-secondary-content",
    accent: "bg-accent text-accent-content",
  },
  warm: {
    primary: "bg-orange-500 text-base-100",
    secondary: "bg-success text-base-100", 
    accent: "bg-pink-500 text-base-100",
  },
  cool: {
    primary: "bg-blue-400 text-slate-900",
    secondary: "bg-emerald-400 text-slate-900",
    accent: "bg-cyan-400 text-slate-900",
  },
} as const;

// === HELPER FUNCTIONS ===
export function combineClasses(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function conditionalClass(condition: boolean, trueClass: string, falseClass: string = ''): string {
  return condition ? trueClass : falseClass;
}

export function themeClass(theme: keyof typeof ThemeTokens, variant: keyof typeof ThemeTokens.smartimmo): string {
  return ThemeTokens[theme]?.[variant] || ThemeTokens.smartimmo[variant];
}
