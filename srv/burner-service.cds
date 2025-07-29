using burner.db as db from '../db/schema';

service BurnerService {
    entity Employees       as projection on db.Employee;
    entity WorkMetrics     as projection on db.Workmetrics;
    entity BurnoutMetrics  as projection on db.Burnoutmetrics;
}