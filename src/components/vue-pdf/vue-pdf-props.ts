import { DocumentInitParameters, PDFDataRangeTransport } from 'pdfjs-dist/types/src/display/api';
import { ExtractPropTypes } from 'vue';

export const props = {
  /**
   * The source of the pdf. Accepts the following types `string | URL | Uint8Array | PDFDataRangeTransport | DocumentInitParameters`
   */
  src: {
    type: [String, Object],
    default: ''
  },
  /**
   * The page number of the pdf to display.
   */
  page: {
    type: Number,
    default: 1
  },
  /**
   * Whether to display all pages, dangerous!!
   */
  allPages: {
    type: Boolean,
    default: false
  },
  /**
   * The scale (zoom) of the pdf. Setting this will also disable auto scaling and resizing.
   */
  scale: {
    type: Number,
    default: 1
  },
  /**
   * page wrapper id prefix
   */
  wrapperIdPrefix: {
    type: String,
    default: 'vue-pdf-page'
  }
};

export type VuePdfPropsType = ExtractPropTypes<typeof props> & {
  src: string | URL | Uint8Array | PDFDataRangeTransport | DocumentInitParameters;
};
