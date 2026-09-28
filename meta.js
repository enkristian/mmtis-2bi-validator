const META = {
 "enums": {
  "DistributionChannelType": [
   "agency",
   "atStop",
   "electronicPass",
   "mobileDevice",
   "onBoard",
   "online",
   "onlineAccount",
   "other",
   "postal",
   "telephone",
   "tourOperator"
  ],
  "DistributionRights": [
   "book",
   "exchange",
   "inform",
   "none",
   "other",
   "private",
   "refund",
   "sell"
  ],
  "FulfilmentMethodType": [
   "agent",
   "conductor",
   "courier",
   "email",
   "mobileApp",
   "other",
   "post",
   "selfprint",
   "sms",
   "ticketMachine",
   "ticketOffice",
   "topUpDevice",
   "validator"
  ],
  "MachineReadable": [
   "anpr",
   "barCode",
   "chip",
   "magneticStrip",
   "nfc",
   "none",
   "ocr",
   "other",
   "qrCode",
   "shotCode"
  ],
  "MediaType": [
   "card",
   "coupon",
   "licencePlate",
   "mms",
   "mobileApp",
   "none",
   "other",
   "paperTicket",
   "paperTicketWithCoupons",
   "selfPrintPaperTicket",
   "smartCard",
   "sms"
  ],
  "PaymentMethods": [
   "bankTransfer",
   "banknote",
   "cardsOnly",
   "cash",
   "cashAndCard",
   "cashExactChangeOnly",
   "cheque",
   "coin",
   "companyCheque",
   "contactlessPaymentCard",
   "contactlessTravelCard",
   "creditCard",
   "debitCard",
   "directDebit",
   "epayAccount",
   "epayDevice",
   "mileagePoints",
   "mobileApp",
   "mobilePhone",
   "other",
   "postalOrder",
   "sms",
   "token",
   "travelCard",
   "travellersCheque",
   "voucher",
   "warrant"
  ]
 },
 "productRefs": [
  "AmountOfPriceUnitProductRef",
  "CappedDiscountRightRef",
  "EntitlementProductRef",
  "FareProductRef",
  "PreassignedFareProductRef",
  "SaleDiscountRightRef",
  "ServiceAccessRightRef",
  "SupplementProductRef",
  "ThirdPartyProductRef",
  "UsageDiscountRightRef"
 ],
 "rules": {
  "XML-01": [
   {
    "level": "ERROR",
    "text": "Fila kan ikkje lesast som XML. DOCTYPE blir avvist, sidan NeTEx ikkje brukar DTD (vern mot XXE og entitetsekspansjon)."
   }
  ],
  "XML-02": [
   {
    "level": "ERROR",
    "text": "Rotelementet er ikkje PublicationDelivery."
   }
  ],
  "XSD-01": [
   {
    "level": "ERROR",
    "text": "Kvar feil frå xmllint --noout --schema NeTEx_publication.xsd blir éin ERROR, med fil og linje frå xmllint."
   }
  ],
  "XSD-00": [
   {
    "level": "ERROR",
    "text": "Validatoren fann ikkje xmllint, eller xmllint feila utan å gi melding."
   }
  ],
  "MA-SOP-00": [
   {
    "level": "ERROR",
    "text": "Datasettet har minst éin SalesOfferPackage."
   }
  ],
  "MA-SOP-01": [
   {
    "level": "ERROR",
    "text": "Har @id og @version."
   }
  ],
  "MA-SOP-02": [
   {
    "level": "ERROR",
    "text": "Har ein Name som ikkje er tom."
   }
  ],
  "MA-SOP-03": [
   {
    "level": "ERROR",
    "text": "Har ValidBetween eller validityConditions på sjølve salspakken. Validatoren les ikkje gyldigheit frå rammene."
   }
  ],
  "MA-SPE-01": [
   {
    "level": "ERROR",
    "text": "Har minst eitt SalesOfferPackageElement med produktreferanse. Gyldige produktreferansar er alle element i substitusjonsgruppa ServiceAccessRightRef, lesne frå XSD-en (PreassignedFareProductRef, SupplementProductRef, FareProductRef osb.)."
   }
  ],
  "MA-DA-01": [
   {
    "level": "ERROR",
    "text": "Har minst éin DistributionAssignment, anten inne i salspakken eller i ramma med SalesOfferPackageRef til han."
   }
  ],
  "MA-DA-02": [
   {
    "level": "ERROR",
    "text": "Har DistributionChannelRef eller DistributionChannelType."
   }
  ],
  "MA-DA-03": [
   {
    "level": "ERROR",
    "text": "Har FulfilmentMethodRef. Feltet er 0..1, så det trengst éin DA per utferdingsmåte."
   }
  ],
  "MA-DA-04": [
   {
    "level": "ERROR",
    "text": "Har PaymentMethods, anten på DA-en eller på DistributionChannel-en han peikar til (sjå «Må*» i notatet)."
   }
  ],
  "MA-DC-01": [
   {
    "level": "ERROR",
    "text": "Har Name."
   }
  ],
  "MA-DC-02": [
   {
    "level": "ERROR",
    "text": "Har DistributionChannelType. Den nordiske profilen krev 1..1."
   }
  ],
  "MA-FM-01": [
   {
    "level": "ERROR",
    "text": "Har FulfilmentMethodType."
   }
  ],
  "MA-FM-02": [
   {
    "level": "ERROR",
    "text": "Har Name. Tabellen i notatet set «id, Name, FulfilmentMethodType» som Må, og «Datakvalitet» seier at dei to utferdingsmåtane våre manglar namn."
   }
  ],
  "BOR-SPE-01": [
   {
    "level": "WARN",
    "text": "Manglar TypeOfTravelDocumentRef."
   }
  ],
  "BOR-DA-01": [
   {
    "level": "WARN",
    "text": "Manglar DistributionRights (sell, refund, exchange …)."
   }
  ],
  "BOR-DC-01": [
   {
    "level": "WARN",
    "text": "Manglar ContactDetails/Url."
   }
  ],
  "BOR-DC-02": [
   {
    "level": "WARN",
    "text": "Manglar OrganisationRef eller ein anna organisasjonsreferanse (AuthorityRef, OperatorRef …). Dette dekkjer raden «Organisation / Authority: eigar av kanal»."
   }
  ],
  "BOR-TOTD-01": [
   {
    "level": "WARN",
    "text": "Manglar MediaType."
   }
  ],
  "BOR-TOTD-02": [
   {
    "level": "WARN",
    "text": "Manglar MachineReadable."
   }
  ],
  "ENUM-01": [
   {
    "level": "ERROR",
    "text": "Kvar verdi i DistributionChannelType, FulfilmentMethodType, PaymentMethods, DistributionRights, MediaType og MachineReadable finst i NeTEx 2.0-enumen. Døme på feil: customerAccount, vipps, PAPER_TICKET, INFROM."
   }
  ],
  "ENUM-02": [
   {
    "level": "WARN",
    "text": "Verdien er generisk og seier ikkje kvar eller korleis: other i alle seks felta, og i tillegg none for DistributionRights, MediaType og MachineReadable."
   }
  ],
  "REF-01": [
   {
    "level": "ERROR",
    "text": "Kvart element med namn som sluttar på Ref og har @ref, må treffe eit element med same @id i ei av inndatafilene."
   }
  ],
  "REF-02": [
   {
    "level": "ERROR",
    "text": "Når referansen har @version (og verdien ikkje er any), må målet ha nøyaktig den versjonen. Meldinga viser kva versjonar som finst."
   }
  ],
  "REF-03": [
   {
    "level": "ERROR",
    "text": "Same @id + @version finst meir enn éin gong i same fil."
   },
   {
    "level": "ERROR",
    "text": "Same @id + @version finst i fleire filer, og innhaldet er ulikt etter normalisering. Meldinga viser begge plasseringane."
   },
   {
    "level": "WARN",
    "text": "Same @id + @version finst i fleire filer med identisk innhald, til dømes ein delt kanal, utferdingsmåte eller autoritet som er kopiert inn i kvar fil."
   }
  ],
  "REF-04": [
   {
    "level": "ERROR",
    "text": "@id eller @ref inneheld :Test, som i ENT:DistributionChannel:Test."
   }
  ],
  "REF-05": [
   {
    "level": "ERROR",
    "text": "DistributionChannelRef, FulfilmentMethodRef, TypeOfTravelDocumentRef og SalesOfferPackageRef peikar på eit element av rett type."
   }
  ],
  "DEL-01": [
   {
    "level": "WARN",
    "text": "Leveransen har fleire filer, men ingen av dei byrjar med _. DEL-03 til DEL-06 og DEL-09 blir då hoppa over. Tilrådd namn er _<CODESPACE>_shared_data.xml (nordisk konvensjon)."
   }
  ],
  "DEL-02": [
   {
    "level": "WARN",
    "text": "Filene har ulik ParticipantRef eller ulik PublicationDelivery/@version. Eige profilval."
   }
  ],
  "DEL-03": [
   {
    "level": "WARN",
    "text": "Ei einingsfil peikar på eit objekt som berre finst i ei anna einingsfil. Einingsfiler skal berre vere avhengige av delte filer og seg sjølve (nordisk konvensjon)."
   }
  ],
  "DEL-04": [
   {
    "level": "WARN",
    "text": "Ei delt fil inneheld ein SalesOfferPackage. Salspakkar høyrer til i einingsfilene (nordisk konvensjon)."
   }
  ],
  "DEL-05": [
   {
    "level": "WARN",
    "text": "Ei delt fil peikar på eit objekt som berre finst i ei einingsfil. Delte filer skal vere sjølvstendige (nordisk konvensjon)."
   }
  ],
  "DEL-06": [
   {
    "level": "WARN",
    "text": "Eit toppobjekt i ei delt fil blir ikkje brukt av nokon einingsfil, direkte eller gjennom andre objekt i delte filer."
   }
  ],
  "DEL-07": [
   {
    "level": "WARN",
    "text": "Ein CompositeFrame manglar ValidBetween eller validityConditions, eller ei ramme inne i han har eiga gyldigheit (nordisk konvensjon)."
   }
  ],
  "DEL-08": [
   {
    "level": "WARN",
    "text": "Same @id (uansett versjon) er definert i fleire einingsfiler. Objektet bør flyttast til ei delt fil. Rammer er unnatekne (nordisk konvensjon)."
   }
  ],
  "DEL-09": [
   {
    "level": "WARN",
    "text": "Same @id er definert i fleire delte filer. Rammer er unnatekne (nordisk konvensjon)."
   }
  ],
  "DEL-10": [
   {
    "level": "WARN",
    "text": "Ein referanse på tvers av filer brukar version i staden for versionRef. Då feilar keyref i XSD-en når fila blir validert åleine."
   }
  ],
  "DEL-11": [
   {
    "level": "WARN",
    "text": "Fila har referansar til ei anna fil, men ingen ramme har prerequisites til ei ramme i den fila."
   }
  ],
  "DEL-12": [
   {
    "level": "WARN",
    "text": "Ein versionRef peikar på ein versjon som ikkje finst i leveransen, sjølv om id-en finst. REF-02 sjekkar berre version."
   }
  ]
 }
};
