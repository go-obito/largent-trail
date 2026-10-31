from largent.modules.needs.link_import import extract_link_import_suggestion


def test_product_preview_prefixes_json_ld_brand_when_title_omits_it() -> None:
    html = b"""
    <html><head>
      <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "iPhone 16 Pro",
          "brand": {"@type": "Brand", "name": "Apple"}
        }
      </script>
    </head></html>
    """

    suggestion = extract_link_import_suggestion(html)

    assert suggestion.name == "Apple iPhone 16 Pro"


def test_product_preview_does_not_duplicate_brand_in_title() -> None:
    html = b"""
    <html><head>
      <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Apple iPhone 16 Pro",
          "brand": {"@type": "Brand", "name": "Apple"}
        }
      </script>
    </head></html>
    """

    suggestion = extract_link_import_suggestion(html)

    assert suggestion.name == "Apple iPhone 16 Pro"
