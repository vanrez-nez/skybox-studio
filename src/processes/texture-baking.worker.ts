import { bakeDirectionSpaceGradientData } from "@/processes/texture-baking-core";
import type { GradientState } from "@/store/modules/layers";

export type TextureBakeWorkerRequest = {
  gradient: GradientState;
  id: number;
  width?: number;
};

export type TextureBakeWorkerResponse = {
  data: ArrayBuffer;
  height: number;
  id: number;
  width: number;
};

type TextureBakeWorkerScope = {
  onmessage: ((event: MessageEvent<TextureBakeWorkerRequest>) => void) | null;
  postMessage: (message: TextureBakeWorkerResponse, transfer: Transferable[]) => void;
};

const workerSelf = self as unknown as TextureBakeWorkerScope;

workerSelf.onmessage = (event: MessageEvent<TextureBakeWorkerRequest>) => {
  const bakedImage = bakeDirectionSpaceGradientData(event.data.gradient, {
    width: event.data.width,
  });
  const response: TextureBakeWorkerResponse = {
    data: bakedImage.data.buffer,
    height: bakedImage.height,
    id: event.data.id,
    width: bakedImage.width,
  };

  workerSelf.postMessage(response, [response.data]);
};
