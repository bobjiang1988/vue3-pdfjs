
<template>
  <div class="vue-pdf"
       ref="pdfWrapperRef"></div>
</template>

<script lang="ts">
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import PDFJSWorker from 'pdfjs-dist/legacy/build/pdf.worker.entry';
import {
  PDFDocumentProxy,
  PDFPageProxy
} from 'pdfjs-dist/types/src/display/api';
import { PageViewport } from 'pdfjs-dist/types/src/display/display_utils';
import { defineComponent, ref, toRefs } from 'vue';
import { createLoadingTask } from './loading-task';
import { props, VuePdfPropsType } from './vue-pdf-props';

export default defineComponent({
  name: 'vue-pdf',
  props,
  setup(props: VuePdfPropsType, { emit }) {
    const pdfWrapperRef = ref<HTMLElement>();
    const pdfDoc = ref<PDFDocumentProxy>();
    const pdfPages = ref<PDFPageProxy[]>();
    const baseScale = ref(0);
    const currentViewport = ref<PageViewport>();
    const scaling = ref(false);

    const { src, wrapperIdPrefix, page, allPages, scale } = toRefs(props);

    const clean = async () => {
      await pdfDoc.value?.destroy();
      scaling.value = false;
      baseScale.value = 0;
      currentViewport.value = undefined;
      pdfDoc.value = undefined;
      pdfPages.value = undefined;
      const pdfWrapperEl = pdfWrapperRef.value as HTMLElement;
      if (!pdfWrapperEl) return;
      pdfWrapperEl.innerHTML = '';
    };

    const initPdfDocument = async () => {
      await clean();
      emit('progress', 0);
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJSWorker;

        const pdf = await createLoadingTask(src.value).promise;
        pdfDoc.value = pdf;

        emit('pdfLoaded', pdf);
        emit('totalPages', pdf.numPages);

        if (allPages.value) {
          // ignore pageNumber, display all pages
          const pagePromiseArr = new Array(pdf.numPages)
            .fill(0)
            .map((v, idx) => pdf.getPage(idx + 1));

          pdfPages.value = await Promise.all(pagePromiseArr);
        } else if (page.value <= pdf.numPages) {
          pdfPages.value = [await pdf.getPage(page.value)];
        }
        if (pdfPages.value) {
          await Promise.all(pdfPages.value.map(renderPage));
        }
      } catch (error) {
        console.error('init pdf failed:', error);
        await clean();
      }
      emit('progress', 100);
    };

    const createWrapper = (page: PDFPageProxy) => {
      const pdfWrapperEl = pdfWrapperRef.value as HTMLElement;

      // Create a wrapper for each page
      const pageWrapper = document.createElement('div');
      pageWrapper.classList.add('vue-pdf__wrapper');
      pageWrapper.id = `${wrapperIdPrefix.value}-${page.pageNumber}`;

      // Create a canvas element for each page to draw on
      const canvas = document.createElement('canvas');
      pageWrapper.appendChild(canvas);
      pdfWrapperEl.appendChild(pageWrapper);
    };

    const resetBaseScale = (page: PDFPageProxy) => {
      if (baseScale.value) return;
      const initViewport = page.getViewport({ scale: 1 });

      const pdfWrapperEl = pdfWrapperRef.value as HTMLElement;
      const pdfWrapperElWidth = pdfWrapperEl.getBoundingClientRect().width;
      baseScale.value = pdfWrapperElWidth / initViewport.width;
    };

    const resetTargetViewport = (page: PDFPageProxy) => {
      if (currentViewport.value) return;
      const targetScale = scale.value * baseScale.value;
      currentViewport.value = page.getViewport({
        scale: targetScale
      });
    };

    const renderPage = async (page: PDFPageProxy) => {
      createWrapper(page);
      resetBaseScale(page);
      resetTargetViewport(page);
      await scaleCanvas(page);
      const size = pdfPages.value?.length || 1;
      emit('pageLoaded', page);
      // prettier-ignore
      emit('progress', Number(((100 * page.pageNumber) / size).toFixed(2)));
    };

    const scaleCanvas = async (page: PDFPageProxy) => {
      const viewport = currentViewport.value as PageViewport;
      // prettier-ignore
      const canvas = document.getElementById(`${wrapperIdPrefix.value}-${page.pageNumber}`)?.querySelector('canvas') as HTMLCanvasElement;
      // assume the device pixel ratio is 1 if the browser doesn't specify it
      const devicePixelRatio = window.devicePixelRatio || 1;
      const context = canvas.getContext('2d') as CanvasRenderingContext2D;
      // determine the 'backing store ratio' of the canvas context
      const backingStoreRatio =
        // @ts-ignore
        context.webkitBackingStorePixelRatio ||
        // @ts-ignore
        context.mozBackingStorePixelRatio ||
        // @ts-ignore
        context.msBackingStorePixelRatio ||
        // @ts-ignore
        context.oBackingStorePixelRatio ||
        // @ts-ignore
        context.backingStorePixelRatio ||
        1;

      // determine the actual ratio we want to draw at
      const ratio = devicePixelRatio / backingStoreRatio;

      // set the 'real' canvas size to the higher width/height
      canvas.width = viewport.width * ratio;
      canvas.height = viewport.height * ratio;
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      // scale the drawing context so everything will work at the higher ratio
      context.scale(ratio, ratio);
      await page
        .render({
          canvasContext: context,
          viewport
        })
        .promise.catch((err) => {
          console.error('render page error: ', err);
        });
    };

    const doScale = async () => {
      if (!pdfPages.value || scaling.value) return;
      scaling.value = true;
      baseScale.value = 0;
      currentViewport.value = undefined;
      for (const page of pdfPages.value) {
        resetBaseScale(page);
        resetTargetViewport(page);
        await scaleCanvas(page).catch((err) => {
          console.error('scale error', err);
        });
      }
      scaling.value = false;
    };

    let scaleTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(scaleTimer);
      scaleTimer = setTimeout(doScale, 500);
    });

    return {
      pdfWrapperRef,
      initPdfDocument,
      doScale
    };
  },
  mounted() {
    this.initPdfDocument();
  },
  watch: {
    src() {
      this.initPdfDocument();
    },
    scale() {
      this.doScale();
    }
  }
});
</script>


<style lang="scss">
.vue-pdf {
  overflow: auto;
  &__wrapper {
    position: relative;
  }
}
</style>

