
/* The weight of star rating in the final demand metric for a listing is dependent upon the number of reviews 
which resulted in the star rating (statistical significance). 

It is not necessarily a linear function: I've decided that 3 reviews or less will give their star rating only
a 10% weight; between 4 and 10 reviews will give a 25% weight; between 11 and 20 reviews will increase to a 
33% weight; and any number of reviews over 21 gives the star rating a strong significance of 40% for of the 
final demand score.*/
function getStarRatingWeight(reviewsCount) {
	if (!reviewsCount) return 0;
	if (reviewsCount <= 3) return 0.1;
	if (reviewsCount <= 10) return 0.25;
	if (reviewsCount <= 20) return 0.33;
	if (reviewsCount >= 21) return 0.4;
}

//REMEMBER: Stars only appear after your third review.


//assumes uniform distribution of prices in the city
function getFinalDemandScoreForListing(starRating, reviewsCount, occupancyScore, avgNightlyPrice, isSuperHost, 
	minLocationPrice, maxLocationPrice) {
	//TODO WHAT ABOUT STAR RATING = NULL? need to ignore stars alltogehter (under 3 reviews)
	const starRatingWeight = getStarRatingWeight(reviewsCount);
	const restWeight = 1 - starRatingWeight; // all other parameters combined will have this weight
	const normalizedRating = normalize(0, 5)(starRating) * starRatingWeight;

	const normalizedOccupancy = normalize(0, 366)(occupancyScore);
	//price may reflect WTP and also on average high demand areas tend to have higher prices 
	//(because of the demand) (confusing cause and effect, but..) 
	// two listing with the same occupancyScore, the more expensive one should get higher demand score
	const normalizedPrice = normalize(minLocationPrice, maxLocationPrice)(avgNightlyPrice);
	let  restScore = (0.7 * normalizedOccupancy) + (0.3 * normalizedPrice);
	restScore = isSuperHost ? restScore * 1.15 : restScore;
	const normalizedRestScore = normalize(0, 1.15)(restScore);
	const finalScore = (restWeight * normalizedRestScore) + normalizedRating;
	
	if (finalScore > 1) console.log ('ERROR ITS MORE THAN 1!!!!!!!!!!!!!!!!!!1');
	console.log(`starRating: ${starRating}, reviewsCount: ${reviewsCount}, occupancyScore: ${occupancyScore}`);
	console.log(`avgPrice: ${avgNightlyPrice}, isSuperHost: ${isSuperHost}`);
	console.log(`-----`);
	console.log(`restScore: ${restScore}, normalizedRestScore: ${normalizedRestScore}, normalizedRating: ${normalizedRating}`)
	console.log(`====> FINAL SCORE: ${finalScore}\n\n`);

	return finalScore; 
}

/* retunrs a function that scales values between 0 and 1*/
function normalize(min, max) {
    const delta = max - min;
    return function (val) {
        return (val - min) / delta;
    };
}

module.exports = {getFinalDemandScoreForListing};
//export default {getFinalDemandScoreForListing};
