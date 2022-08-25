
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
import { computed, defineComponent, ref, toRefs } from 'vue';
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
    const scaling = ref(false);
    const { src, wrapperIdPrefix, page, allPages, scale } = toRefs(props);

    const targetScale = computed(() => baseScale.value * scale.value);

    let resizeTimer = 0;
    let scaleTimer = 0;

    const clean = async () => {
      await pdfDoc.value?.destroy();
      baseScale.value = 0;
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
          resetBaseScale();
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

    const getPageSize = (page: PDFPageProxy, scale = 1) => {
      const viewBox = page.view;
      const width = Math.abs(viewBox[2] - viewBox[0]) * scale;
      const height = Math.abs(viewBox[3] - viewBox[1]) * scale;
      return { width, height };
    };

    const resetBaseScale = () => {
      if (!pdfPages.value) return;
      const page = pdfPages.value[0];

      const width = getPageSize(page).width;

      const pdfWrapperEl = pdfWrapperRef.value as HTMLElement;
      const pdfWrapperElWidth = pdfWrapperEl.getBoundingClientRect().width;

      baseScale.value = pdfWrapperElWidth / width;
    };

    const renderPage = async (page: PDFPageProxy) => {
      createWrapper(page);
      await scaleCanvas(page);
      const size = pdfPages.value?.length || 1;
      emit('pageLoaded', page);
      // prettier-ignore
      emit('progress', Number(((100 * page.pageNumber) / size).toFixed(2)));
    };

    const getCanvas = (page: PDFPageProxy) => {
      return document
        .getElementById(`${wrapperIdPrefix.value}-${page.pageNumber}`)
        ?.querySelector('canvas') as HTMLCanvasElement;
    };

    const scaleCanvas = async (page: PDFPageProxy) => {
      const viewport = page.getViewport({ scale: targetScale.value });
      const canvas = getCanvas(page);
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

    const realScale = async () => {
      if (!pdfPages.value) return;
      for (const page of pdfPages.value) {
        await scaleCanvas(page).catch((err) => {
          console.error('scale error', err);
        });
      }
    };

    const fakeScale = () => {
      if (!pdfPages.value) return;
      const pdfWrapperEl = pdfWrapperRef.value as HTMLElement;
      const page = pdfPages.value[0];

      const { width, height } = getPageSize(page, targetScale.value);
      // prettier-ignore
      // console.log('targetScale.value = ', targetScale.value, 'width = ', width, 'height = ', height);
      const canvases = pdfWrapperEl.querySelectorAll('canvas');
      canvases.forEach((canvas) => {
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
      });
    };

    const doScale = () => {
      if (!pdfPages.value) return;
      if (scaling.value) return;
      fakeScale();
      clearTimeout(scaleTimer);
      scaleTimer = setTimeout(async () => {
        scaling.value = true;
        await realScale();
        scaling.value = false;
      }, 500);
    };

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resetBaseScale();
        doScale();
      }, 500);
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

