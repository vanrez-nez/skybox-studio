const DB_NAME = "skybox-studio-assets";
const DB_VERSION = 1;
const IMAGE_STORE_NAME = "images";

function openAssetDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        database.createObjectStore(IMAGE_STORE_NAME);
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error ?? new Error("Image asset database failed.")));
  });
}

async function runImageAssetTransaction<T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>
) {
  const database = await openAssetDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE_NAME, mode);
    const request = handler(transaction.objectStore(IMAGE_STORE_NAME));

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error ?? new Error("Image asset request failed.")));
    transaction.addEventListener("complete", () => database.close());
    transaction.addEventListener("abort", () => {
      database.close();
      reject(transaction.error ?? new Error("Image asset transaction aborted."));
    });
  });
}

export function createImageAssetId() {
  return `image-${crypto.randomUUID()}`;
}

export function putImageAsset(assetId: string, blob: Blob) {
  return runImageAssetTransaction("readwrite", (store) => store.put(blob, assetId));
}

export async function getImageAsset(assetId: string) {
  const blob = await runImageAssetTransaction("readonly", (store) => store.get(assetId));

  return blob instanceof Blob ? blob : null;
}

export function deleteImageAsset(assetId: string) {
  return runImageAssetTransaction("readwrite", (store) => store.delete(assetId));
}

