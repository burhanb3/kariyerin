from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "menu": Path("C:/Users/ahmet/Downloads/4646e3fa-e60a-4e76-911a-e16283637a03.jpg"),
    "player": Path("C:/Users/ahmet/Downloads/75542257-7bc6-4b77-a4a2-bd7c5c4d1557.jpg"),
}
OUTPUTS = {
    "menu": ROOT / "public/assets/mascot-menu.png",
    "player": ROOT / "public/assets/mascot-player.png",
}


def is_background_pixel(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    return red > 236 and green > 236 and blue > 236 and max(pixel) - min(pixel) < 22


def connected_background_mask(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def push_if_background(x: int, y: int) -> None:
        index = y * width + x
        if seen[index] or not is_background_pixel(pixels[x, y]):
            return
        seen[index] = 255
        queue.append((x, y))

    for x in range(width):
        push_if_background(x, 0)
        push_if_background(x, height - 1)
    for y in range(height):
        push_if_background(0, y)
        push_if_background(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                push_if_background(nx, ny)

    return Image.frombytes("L", (width, height), bytes(seen))


def transparent_crop(source: Path, output: Path, max_side: int, padding: int, erase_top_rows: int = 0) -> None:
    image = Image.open(source).convert("RGBA")
    bg_mask = connected_background_mask(image)
    soft_mask = bg_mask.filter(ImageFilter.GaussianBlur(1.2))
    alpha = Image.eval(soft_mask, lambda value: 255 - value)

    if erase_top_rows:
        alpha_pixels = alpha.load()
        for y in range(min(erase_top_rows, alpha.height)):
            for x in range(alpha.width):
                alpha_pixels[x, y] = 0

    image.putalpha(alpha)

    bbox = alpha.point(lambda value: 255 if value > 18 else 0).getbbox()
    if bbox is None:
        raise RuntimeError(f"No mascot pixels found in {source}")

    left, top, right, bottom = bbox
    cropped = image.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(image.width, right + padding),
            min(image.height, bottom + padding),
        )
    )

    scale = min(1.0, max_side / max(cropped.size))
    if scale < 1.0:
        cropped = cropped.resize(
            (round(cropped.width * scale), round(cropped.height * scale)),
            Image.Resampling.LANCZOS,
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(output)
    print(f"{output.relative_to(ROOT)} {cropped.width}x{cropped.height}")


def main() -> None:
    transparent_crop(SOURCES["menu"], OUTPUTS["menu"], max_side=640, padding=18, erase_top_rows=18)
    transparent_crop(SOURCES["player"], OUTPUTS["player"], max_side=620, padding=24)


if __name__ == "__main__":
    main()
