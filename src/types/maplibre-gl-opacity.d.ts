declare module "maplibre-gl-opacity" {
    import { IControl, Map } from "maplibre-gl";

    interface OpacityControlOptions {
        baseLayers: {
            [key: string]: string;
        };
    }

    export default class OpacityControl implements IControl {
        constructor(options: OpacityControlOptions);
        onAdd(map: Map): HTMLElement;
        onRemove(): void;
    }
}
