import 'babel-polyfill';
import Promise from 'bluebird';
import { run } from './main';

const argv = require('minimist')(process.argv.slice(2));
const scripts = [run];

if (argv._.length === 0 || argv.help || argv.h) {
    console.log('----- get-airbnb-demand ------');
    console.log('\n');
    console.log('Usage: ');
    console.log('$ node get-airbnb-demand <location> [limit (optional)]');
    console.log('\r\n');
    console.log('Where location is a city name (e.g., Paris) and limit (optional) is the number of listings to search for.');
    console.log('\r\n');
    console.log('Examples: ');
    console.log('\n');  
    console.log('$ node get-airbnb-demand \'New York\'');
    console.log('\n');
    console.log('$ node get-airbnb-demand Dublin 5000');
    console.log('\r\n');
    console.log('Results will be saved in Demand.* collection in database (make sure mongodb server is up) and exported to JSON file.');
    process.exit();
}
const location = (argv._[0]);
const limit = (argv._[1]);

Promise.each(scripts, async (script) => {return await script(location, limit)}).then(() => process.exit());
