/**
 * `localStorage` key holding the details-rail visibility preference.
 *
 * Exported so the controller below AND the pre-paint script interpolate the
 * SAME constant — two string literals could silently drift and leave the
 * pre-paint restore reading a key nothing ever writes (the pattern
 * `TOC_VISIBILITY_PREPAINT_SCRIPT` uses with `TOC_STORAGE_KEY`).
 * Only the exact value `"false"` means collapsed; anything else (including a
 * missing entry) means visible, so the default needs no stored value.
 */
export const ASSET_DETAILS_STORAGE_KEY = "zudo-doc-asset-details-visible";

/**
 * `<html>` attribute marking the details rail as collapsed.
 *
 * Lives on `<html>` — not on the page wrapper — because the pre-paint script
 * runs before `<body>` is parsed, so `<html>` is the only element that can
 * carry pre-paint state (#3941 D3). Listed in doc-layout's `preserveHtmlAttrs`
 * so it survives an SPA swap before paint.
 */
export const ASSET_DETAILS_HIDDEN_ATTR = "data-asset-details-hidden";

/**
 * Pre-paint inline script body: restore the persisted collapsed preference to
 * `<html data-asset-details-hidden>` before first paint, so a hard reload of a
 * collapsed asset page never flashes the expanded rail.
 *
 * A tiny synchronous IIFE intended for the page `<head>`. Silently no-ops when
 * storage is disabled or throws (private mode, blocked cookies).
 */
export const ASSET_DETAILS_PREPAINT_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(
  ASSET_DETAILS_STORAGE_KEY,
)})==='false'){document.documentElement.setAttribute(${JSON.stringify(
  ASSET_DETAILS_HIDDEN_ATTR,
)},'');}}catch(e){}})();`;

/** Inline bootstrap for asset-page controls. Kept dependency-free for SSR. */
export const ASSET_PAGE_SCRIPT = String.raw`(()=>{const DKEY=${JSON.stringify(
  ASSET_DETAILS_STORAGE_KEY,
)};const DATTR=${JSON.stringify(
  ASSET_DETAILS_HIDDEN_ATTR,
)};const readDetails=()=>{try{return localStorage.getItem(DKEY)!=='false'}catch(e){return true}};const writeDetails=visible=>{try{localStorage.setItem(DKEY,String(visible))}catch(e){}};const applyDetails=(toggle,visible)=>{const root=document.documentElement;if(root){if(visible){root.removeAttribute(DATTR)}else{root.setAttribute(DATTR,'')}}if(toggle){toggle.setAttribute('aria-expanded',String(visible));const label=toggle.getAttribute(visible?'data-zd-label-collapse':'data-zd-label-expand');if(label)toggle.setAttribute('aria-label',label)}};const init=()=>{document.querySelectorAll('[data-zd-asset-page]').forEach(page=>{if(page.hasAttribute('data-zd-asset-ready'))return;page.setAttribute('data-zd-asset-ready','true');const detailsToggle=page.querySelector('[data-zd-asset-details-toggle]');if(detailsToggle)detailsToggle.removeAttribute('disabled');let detailsVisible=readDetails();applyDetails(detailsToggle,detailsVisible);const pre=page.querySelector('.zd-asset-code');page.addEventListener('click',event=>{const target=event.target;if(!(target instanceof Element))return;const button=target.closest('button');if(target.closest('[data-zd-asset-details-toggle]')){detailsVisible=!detailsVisible;applyDetails(detailsToggle,detailsVisible);writeDetails(detailsVisible);return}const action=target.closest('[data-zd-asset-action]')?.getAttribute('data-zd-asset-action');if(action==='copy'||action==='wrap'){const proxy=pre?.closest('.code-block-wrapper')?.querySelector('.code-btn-'+action);if(proxy instanceof HTMLElement)proxy.click();return}if(action==='copy-url'&&button){navigator.clipboard.writeText(button.dataset.zdCopyUrl||location.href);return}const section=target.closest('section');const stage=section?.querySelector('.zd-asset-stage');if(action==='fit'||action==='1to1'){stage?.classList.toggle('is-1to1',action==='1to1');section?.querySelectorAll('[data-zd-asset-action="fit"],[data-zd-asset-action="1to1"]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));return}if((action==='checker'||action==='dark')&&button){stage?.classList.toggle('is-checker',action==='checker');stage?.classList.toggle('is-dark',action==='dark');section?.querySelectorAll('[data-zd-asset-action="checker"],[data-zd-asset-action="dark"]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));return}const line=target.closest('.zd-asset-code .line');const lineOffset=line?event.clientX-line.getBoundingClientRect().left:Infinity;const gutterWidth=line?parseFloat(getComputedStyle(line,'::before').width):0;if(line&&lineOffset<gutterWidth){location.hash=line.id}});if(pre){const wait=()=>{const wrapper=pre.closest('.code-block-wrapper');if(!wrapper){requestAnimationFrame(wait);return}page.querySelectorAll('[data-zd-asset-action="copy"],[data-zd-asset-action="wrap"]').forEach(button=>button.removeAttribute('disabled'))};requestAnimationFrame(wait)}})};if(!document.__zdAssetPageInit){document.__zdAssetPageInit=init;document.addEventListener('zfb:after-swap',init)}document.__zdAssetPageInit()})();`;
