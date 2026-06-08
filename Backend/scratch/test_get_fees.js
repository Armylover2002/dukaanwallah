import axios from 'axios';

async function testGetFees() {
    try {
        const res = await axios.get('http://localhost:5000/api/v1/common/onboarding-fees/public');
        console.log('API Response:', res.data);
    } catch (e) {
        console.error('API Error:', e.message);
    }
}

testGetFees();
