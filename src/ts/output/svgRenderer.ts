import { Resvg, type RenderedImage } from '@resvg/resvg-js'

export function renderSvg(svg: string): RenderedImage {
    return new Resvg(svg).render()
}
