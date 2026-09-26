# Third-party notices

jobfit-jev is released under the MIT License (see [LICENSE](LICENSE)).
This file records third-party code copied into the repository and third-party packages bundled into the unpacked extension build, with their license texts.

## Borrowed code

No third-party source code has been copied into this repository yet.
Each piece borrowed later (planned sources are listed in [`docs/spec.md`](docs/spec.md) §12) gets an entry here with its source URL, commit, and license text.

## Bundled packages

`test/static/third-party-notices.test.ts` fails when a production dependency in `package-lock.json` is missing from this list or is not MIT, Apache-2.0, or BSD licensed.

### react

- Source: https://github.com/react/react (`packages/react`)
- Used for: popup and full-tab UI
- License: MIT, Copyright (c) Meta Platforms, Inc. and affiliates ([text](#mit-license-meta-platforms-inc-and-affiliates))

### react-dom

- Source: https://github.com/react/react (`packages/react-dom`)
- Used for: popup and full-tab UI
- License: MIT, Copyright (c) Meta Platforms, Inc. and affiliates ([text](#mit-license-meta-platforms-inc-and-affiliates))

### scheduler

- Source: https://github.com/react/react (`packages/scheduler`)
- Used for: dependency of react-dom
- License: MIT, Copyright (c) Meta Platforms, Inc. and affiliates ([text](#mit-license-meta-platforms-inc-and-affiliates))

### tailwindcss

- Source: https://github.com/tailwindlabs/tailwindcss (`packages/tailwindcss`)
- Used for: the generated stylesheet of the popup and full tab (a build-time dependency whose output ships; the stylesheet keeps its license banner)
- License: MIT, Copyright (c) Tailwind Labs, Inc. ([text](#mit-license-tailwind-labs-inc))

## License texts

### MIT License (Meta Platforms, Inc. and affiliates)

```text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### MIT License (Tailwind Labs, Inc.)

```text
MIT License

Copyright (c) Tailwind Labs, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
