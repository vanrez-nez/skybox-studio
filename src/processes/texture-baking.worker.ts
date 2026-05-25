import { bakeSkyboxImageData, type SkyboxManifestV1 } from "@/runtime/index";

export type TextureBakeWorkerRequest = {
  id: number;
  manifest: SkyboxManifestV1;
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
  const bakedImage = bakeSkyboxImageData(event.data.manifest, {
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
