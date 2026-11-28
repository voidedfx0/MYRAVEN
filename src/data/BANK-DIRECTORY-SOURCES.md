# Bank directory data source

MYRAVEN's bank picker currently reads country-specific reference records from:

- Project: https://github.com/AbYT101/Global-bank-data
- License: MIT
- Source description: bank names and SWIFT/BIC identifiers compiled from multiple banking data sources and organized by ISO 3166-1 alpha-2 country code.

The upstream dataset is community-maintained. Coverage, freshness, institution status, and SWIFT/BIC accuracy can vary by country. MYRAVEN displays these records as a searchable reference directory only. A listed institution is not a statement that MYRAVEN or any payout provider can send funds to it.

Before enabling bank payouts, MYRAVEN must validate the selected institution and its current payout identifiers against the payout rail/provider being used, and refresh/verify the relevant country data. Keep the data attribution and MIT license notice with any vendored copy of this dataset.
