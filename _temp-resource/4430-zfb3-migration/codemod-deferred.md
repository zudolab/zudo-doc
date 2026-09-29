# JSX codemod deferrals (#4433)

| Candidate | Decision on v2 | Reason / next owner |
| --- | --- | --- |
| `readOnly` → `readonly` | No source occurrence | Codemod supports the spelling; #4437 should handle any new occurrence after the v3 port. |
| Other SVG presentation attributes | Deferred | The measured source uses `strokeWidth`, `strokeLinecap`, and `strokeLinejoin`, which the codemod converts. No other camelCase presentation attribute was present in scoped JSX; #4437 should cover newly introduced SVG markup. |
| Dynamic style objects outside inline JSX | Deferred | The syntax-aware pass changes literal `style={{ ... }}` keys and numeric lengths only. Calculated style objects and style props crossing a component boundary need the v3 renderer and type gate in #4437. |
| `spellcheck` v2 type bridge | Cleanup at #4437 | Preact v2 types reject the required string value. The source supplies the runtime string through a narrow `as unknown as boolean` assertion; remove the assertion when the v3 JSX type accepts the string. |

The kept `tabIndex`, SVG, and inline style conversions pass `pnpm check` and the focused v2 render tests. Full route parity and island-props comparison remain the integration gate before these can be considered verified.
