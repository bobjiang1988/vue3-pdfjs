<div align="center">

![vue supported version](https://img.shields.io/badge/vue-3.x-brightgreen) [![npm](https://img.shields.io/npm/v/vue3-pdfjs)](https://www.npmjs.com/package/vue3-pdfjs/v/latest) [![NPM](https://img.shields.io/npm/l/vue3-pdfjs)](https://github.com/randolphtellis/vue3-pdfjs/blob/main/LICENSE.md)

</div>

Forked from `https://github.com/randolphtellis/vue3-pdfjs` and enhanced a little.


## Install

```bash
npm i @boooooob/vue3-pdfjs
or
yarn add @boooooob/vue3-pdfjs
```

## Usage

### Import globally
```ts
import { createApp } from 'vue'
import App from './App.vue'
import VuePdf from '@boooooob/vue3-pdfjs'

const app = createApp(App)
app.use(VuePdf)
app.mount('#app')
```

### Props

```ts
export interface VuePdfPropsType {
  // The source of the pdf. Accepts the following types `string | URL | Uint8Array | PDFDataRangeTransport | DocumentInitParameters`
  src: string | URL | Uint8Array | PDFDataRangeTransport | DocumentInitParameters;
  // The page number of the pdf to display.
  page?: number;
  // Whether to display all pages. Ignore the prop `page` if true
  allPages?: boolean;
  // The scale (zoom) of the pdf. Setting this will also disable auto scaling and resizing. 
  scale?: number;
  // page wrapper id prefix, default is `vue-pdf-page`
  wrapperIdPrefix?: string;
}

```

### Events

```ts

emit('progress', 0);
emit('pdfLoaded', pdf);
emit('totalPages', pdf.numPages);
emit('pageLoaded', page);

```


### Basic Example

Import components from the `esm` folder to enable tree shaking.
Please note that Mozilla's pdfjs npm package does not export tree-shakeable ES modules. Info here - https://github.com/mozilla/pdf.js/issues/12900
```ts
<script lang="ts">
import { defineComponent, ref } from 'vue';
import VuePdf from '@boooooob/vue3-pdfjs'

export default defineComponent({
  name: 'Home',
  components: { VuePdf },
  setup() {
    const pdfSrc = ref<VuePdfPropsType['src']>('https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf')

    return {
      pdfSrc
    }
  }
});
</script>

<template>
  <VuePdf :src="pdfSrc" all-pages />
</template>
```
